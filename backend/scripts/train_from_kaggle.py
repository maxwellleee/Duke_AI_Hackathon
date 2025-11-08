#!/usr/bin/env python3
"""
Train the repo's SignLanguageModel from an image dataset (Kaggle ASL Alphabet).
- Walks a dataset folder with subfolders per-class (e.g. A, B, C, ...).
- Uses MediaPipe Hands to extract 21 landmarks (x,y,z) per image.
- Converts to shape (n,63) and trains the SignLanguageModel in backend/models.
- Saves model & scaler using the model.save() method (backend/models/asl_model.pkl and asl_scaler.pkl).
Usage:
    # from repo root
    python backend/scripts/train_from_kaggle.py --dataset ./data/asl_alphabet_train --max_images_per_class 200
"""
import os
import sys

# Ensure the repository root is on sys.path so "import backend..." works
REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# now normal imports
import argparse
import json
from pathlib import Path
from collections import defaultdict
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, confusion_matrix
import cv2
import mediapipe as mp
from tqdm import tqdm

from backend.models.sign_language_model import get_model

mp_hands = mp.solutions.hands

def extract_landmarks_from_image(image_bgr, hands):
    """
    Given an OpenCV BGR image and a configured MediaPipe Hands instance,
    return a flattened 63-d feature vector [x1,y1,z1,...,x21,y21,z21] or None if no hand.
    Coordinates are the normalized coordinates provided by MediaPipe (0..1 for x,y).
    """
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = hands.process(image_rgb)
    if not results.multi_hand_landmarks:
        return None
    # Use first detected hand
    lm = results.multi_hand_landmarks[0].landmark
    features = []
    for p in lm:
        features.extend([p.x, p.y, p.z])
    return np.array(features, dtype=np.float32)

def walk_dataset_and_extract(dataset_dir, max_images_per_class=None, skip_bad=True):
    """
    Walk dataset_dir where each subfolder is a label. Return X (n,63) and y (n,) arrays and mapping.
    """
    dataset_dir = Path(dataset_dir)
    X_list = []
    y_list = []
    counts = defaultdict(int)

    # Prepare MediaPipe Hands for static images
    hands = mp_hands.Hands(static_image_mode=True, max_num_hands=1, min_detection_confidence=0.5)

    # Ensure deterministic folder ordering (A..Z) but accept any label names
    classes = sorted([d for d in dataset_dir.iterdir() if d.is_dir()])

    for class_dir in classes:
        label = class_dir.name
        files = sorted(class_dir.glob("*"))
        if max_images_per_class:
            files = files[:max_images_per_class]
        for fp in tqdm(files, desc=f"Processing {label}", unit="img"):
            try:
                img = cv2.imread(str(fp))
                if img is None:
                    continue
                feat = extract_landmarks_from_image(img, hands)
                if feat is None:
                    if skip_bad:
                        continue
                    else:
                        feat = np.zeros(63, dtype=np.float32)
                X_list.append(feat)
                y_list.append(label)
                counts[label] += 1
            except Exception as e:
                print(f"Error processing {fp}: {e}")
                continue

    hands.close()
    if len(X_list) == 0:
        raise RuntimeError("No landmark features extracted. Check dataset path and MediaPipe installation.")
    X = np.vstack(X_list)
    y = np.array(y_list, dtype=object)
    return X, y, counts

def main(args):
    dataset_dir = args.dataset
    max_images = args.max_images_per_class
    min_samples_per_class = args.min_samples_per_class

    if not os.path.isdir(dataset_dir):
        raise FileNotFoundError(f"Dataset folder not found: {dataset_dir}")

    print("Extracting landmarks from dataset (this can take many minutes)...")
    X, y, counts = walk_dataset_and_extract(dataset_dir, max_images_per_class=max_images, skip_bad=True)
    print("Finished extraction.")
    print("Samples per class (extracted):")
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}")

    # Filter classes with too few examples
    classes_to_keep = [c for c, cnt in counts.items() if cnt >= min_samples_per_class]
    if len(classes_to_keep) == 0:
        raise RuntimeError("No classes have enough samples. Lower --min_samples_per_class or add more images.")
    keep_mask = np.isin(y, classes_to_keep)
    X = X[keep_mask]
    y = y[keep_mask]

    # Save a class map to backend/models/class_indices.json for inference mapping later
    class_list = sorted(list(set(y)))
    class_map = {label: int(idx) for idx, label in enumerate(class_list)}
    out_map_path = os.path.join(os.path.dirname(__file__), "..", "models", "class_indices.json")
    out_map_path = os.path.abspath(out_map_path)
    os.makedirs(os.path.dirname(out_map_path), exist_ok=True)
    with open(out_map_path, "w") as f:
        json.dump(class_map, f, indent=2)
    print(f"Wrote class index map to {out_map_path}")

    # Train/test split for evaluation
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

    # Get repo model and train — uses SignLanguageModel.train and then model.save()
    model = get_model()
    print("Beginning model training (this will call model.save() when done)...")
    model.train(X_train, y_train)
    print("Model training saved by model.save()")

    # Evaluate
    X_test_scaled = model.scaler.transform(X_test)
    preds = model.model.predict(X_test_scaled)
    print("Classification report (test set):")
    print(classification_report(y_test, preds, zero_division=0))
    cm = confusion_matrix(y_test, preds, labels=class_list)
    print("Confusion matrix (rows=true, cols=pred):")
    print(cm)

    print("Training + evaluation complete.")
    print("Trained model and scaler should be available at backend/models/asl_model.pkl and asl_scaler.pkl")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, help="Path to dataset root (subfolders per-label)")
    parser.add_argument("--max_images_per_class", type=int, default=None, help="Max images to process per class (for faster runs)")
    parser.add_argument("--min_samples_per_class", type=int, default=30, help="Minimum extracted samples per class to include class")
    args = parser.parse_args()
    main(args)