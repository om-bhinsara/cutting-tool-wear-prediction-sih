
from pathlib import Path
import numpy as np,pandas as pd,torch
from torch.utils.data import DataLoader
from dataset import WearDataset
from model import MultimodalWearModel

ROOT=Path(__file__).resolve().parents[1]
DEVICE=torch.device("cuda" if torch.cuda.is_available() else "cpu")
torch.manual_seed(42); np.random.seed(42)
(ROOT/"checkpoints").mkdir(exist_ok=True); (ROOT/"results").mkdir(exist_ok=True)

tr_ds=WearDataset(ROOT,"train"); va_ds=WearDataset(ROOT,"val"); te_ds=WearDataset(ROOT,"test")
tr=DataLoader(tr_ds,32,shuffle=True,num_workers=0)
va=DataLoader(va_ds,32,shuffle=False,num_workers=0)
te=DataLoader(te_ds,32,shuffle=False,num_workers=0)

EXPS={
"image_only":(True,False,False),
"sensor_only":(False,True,False),
"metadata_only":(False,False,True),
"image_sensor":(True,True,False),
"full_multimodal":(True,True,True)
}
def evaluate(model,loader):
    model.eval(); P=[];Y=[]
    with torch.no_grad():
        for im,se,me,y in loader:
            P.extend(model(im.to(DEVICE),se.to(DEVICE),me.to(DEVICE)).cpu().numpy())
            Y.extend(y.numpy())
    p=np.asarray(P)*tr_ds.y_sd+tr_ds.y_mu; y=np.asarray(Y)*tr_ds.y_sd+tr_ds.y_mu
    mae=np.mean(np.abs(p-y)); rmse=np.sqrt(np.mean((p-y)**2))
    r2=1-np.sum((y-p)**2)/(np.sum((y-y.mean())**2)+1e-9)
    return float(mae),float(rmse),float(r2)

print("Device:",DEVICE)
print("Train/Val/Test:",len(tr_ds),len(va_ds),len(te_ds))
all_results=[]
for name,flags in EXPS.items():
    print("\n"+"="*65); print(name)
    model=MultimodalWearModel(*flags).to(DEVICE)
    opt=torch.optim.AdamW(model.parameters(),lr=2e-3,weight_decay=1e-4)
    lossfn=torch.nn.SmoothL1Loss(); best=1e9; bad=0
    ck=ROOT/"checkpoints"/f"{name}.pt"
    for ep in range(1,31):
        model.train(); losses=[]
        for im,se,me,y in tr:
            im,se,me,y=im.to(DEVICE),se.to(DEVICE),me.to(DEVICE),y.to(DEVICE)
            opt.zero_grad(set_to_none=True); loss=lossfn(model(im,se,me),y)
            loss.backward(); torch.nn.utils.clip_grad_norm_(model.parameters(),2.0); opt.step()
            losses.append(loss.item())
        mae,rmse,r2=evaluate(model,va)
        print(f"Epoch {ep:02d} | loss {np.mean(losses):.4f} | Val MAE {mae:.2f} µm | RMSE {rmse:.2f} | R² {r2:.4f}")
        if mae<best:
            best=mae; bad=0
            torch.save({"model":model.state_dict(),"flags":flags,"y_mu":tr_ds.y_mu,"y_sd":tr_ds.y_sd},ck)
        else: bad+=1
        if bad>=6: break
    model.load_state_dict(torch.load(ck,map_location=DEVICE)["model"])
    mae,rmse,r2=evaluate(model,te)
    print(f"TEST | MAE {mae:.2f} µm | RMSE {rmse:.2f} | R² {r2:.4f}")
    all_results.append([name,mae,rmse,r2])
res=pd.DataFrame(all_results,columns=["experiment","test_MAE_um","test_RMSE_um","test_R2"])
res.to_csv(ROOT/"results"/"ablation_results.csv",index=False)
print("\nFINAL ABLATION RESULTS"); print(res.to_string(index=False))
