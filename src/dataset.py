from pathlib import Path
import numpy as np
import pandas as pd
import torch
from PIL import Image
from torch.utils.data import Dataset


class WearDataset(Dataset):

    def __init__(self, root, split):
        self.root = Path(root)

        # Dataset index
        df = pd.read_csv(self.root / "labels.csv")
        self.df = df[df.split == split].reset_index(drop=True)

        # Machining metadata
        self.num_cols = ["Vc", "n", "fz", "Vf", "Ae", "Ap"]

        tr = df[df.split == "train"]

        self.mu = (
            tr[self.num_cols]
            .astype(float)
            .mean()
            .values
            .astype(np.float32)
        )

        self.sd = (
            tr[self.num_cols]
            .astype(float)
            .std()
            .values
            + 1e-6
        ).astype(np.float32)

        # Wear target normalization
        self.y_mu = float(tr.wear_um.mean())
        self.y_sd = float(tr.wear_um.std() + 1e-6)

        print(
            f"{split}: {len(self.df)} samples | "
            f"image/sensor paths = data/"
        )

    def __len__(self):
        return len(self.df)

    def __getitem__(self, i):

        r = self.df.iloc[i]


        image_path = (
            self.root
            / "data"
            / "edge_images"
            / r.ImageName
        )

        img = (
            np.asarray(
                Image.open(image_path).convert("RGB"),
                dtype=np.float32
            )
            .transpose(2, 0, 1)
            / 255.0
        )

        sensor_path = (
            self.root
            / "data"
            / "sensors"
            / (Path(r.ImageName).stem + ".npy")
        )

        sen = np.load(sensor_path).astype(np.float32)


        meta = (
            r[self.num_cols]
            .astype(float)
            .values
            .astype(np.float32)
        )

        meta = (meta - self.mu) / self.sd

        # Material encoding
        material = 0.0 if r.material == "CK45" else 1.0

        meta = np.r_[
            meta,
            material
        ].astype(np.float32)


        y = (
            float(r.wear_um) - self.y_mu
        ) / self.y_sd

        return (
            torch.from_numpy(img),
            torch.from_numpy(sen),
            torch.from_numpy(meta),
            torch.tensor(y, dtype=torch.float32)
        )