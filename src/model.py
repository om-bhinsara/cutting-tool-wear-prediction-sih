
import torch
import torch.nn as nn

class ImageEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.net=nn.Sequential(
            nn.Conv2d(3,32,5,2,2),nn.BatchNorm2d(32),nn.ReLU(),
            nn.Conv2d(32,64,3,2,1),nn.BatchNorm2d(64),nn.ReLU(),
            nn.Conv2d(64,96,3,2,1),nn.BatchNorm2d(96),nn.ReLU(),
            nn.Conv2d(96,128,3,2,1),nn.BatchNorm2d(128),nn.ReLU(),
            nn.AdaptiveAvgPool2d(1))
        self.fc=nn.Sequential(nn.Linear(128,96),nn.ReLU())
    def forward(self,x): return self.fc(self.net(x).flatten(1))

class SensorEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.net=nn.Sequential(
            nn.Conv1d(5,32,9,padding=4),nn.BatchNorm1d(32),nn.ReLU(),
            nn.Conv1d(32,64,7,padding=3),nn.ReLU(),nn.MaxPool1d(2),
            nn.Conv1d(64,96,5,padding=2),nn.ReLU(),
            nn.Conv1d(96,128,5,padding=2),nn.ReLU(),
            nn.AdaptiveAvgPool1d(1))
        self.fc=nn.Sequential(nn.Linear(128,64),nn.ReLU())
    def forward(self,x): return self.fc(self.net(x).flatten(1))

class MetaEncoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.net=nn.Sequential(nn.Linear(7,32),nn.ReLU(),nn.Linear(32,48),nn.ReLU())
    def forward(self,x): return self.net(x)

class MultimodalWearModel(nn.Module):
    def __init__(self,image=True,sensor=True,metadata=True):
        super().__init__(); self.flags=(image,sensor,metadata)
        self.image=ImageEncoder() if image else None
        self.sensor=SensorEncoder() if sensor else None
        self.meta=MetaEncoder() if metadata else None
        d=(96 if image else 0)+(64 if sensor else 0)+(48 if metadata else 0)
        self.head=nn.Sequential(nn.Linear(d,96),nn.ReLU(),nn.Dropout(.10),nn.Linear(96,48),nn.ReLU(),nn.Linear(48,1))
    def forward(self,img,sen,meta):
        z=[]
        if self.image is not None:z.append(self.image(img))
        if self.sensor is not None:z.append(self.sensor(sen))
        if self.meta is not None:z.append(self.meta(meta))
        return self.head(torch.cat(z,1)).squeeze(1)
