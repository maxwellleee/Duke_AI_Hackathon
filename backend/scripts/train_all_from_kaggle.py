#!/usr/bin/env python3
"""
Extract MediaPipe landmarks from all images in a dataset and train the repo's SignLanguageModel.
This script caches extracted features to backend/models/landmark_cache.npz so subsequent runs
skip extraction and only retrain / evaluate quickly.
Usage (from repo root):
    # extract & train on ALL images
    python backend/scripts/train_all_from_kaggle.py --dataset ./data --min_samples_per_class 30
    # to force re-extraction (ignore cache)
    python backend/scripts/train_all_from_kaggle.py --dataset ./data --force-extract
"""
import os
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

CACHE_PATH = os.path.join("backend", "models", "landmark_cache.npz")
CLASS_MAP_PATH = os.path.join("backend", "models", "class_indices.json")

mp_hands = mp.solutions.hands

def extract_landmarks_from_image(image_bgr, hands):
    image_rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
    results = hands.process(image_rgb)
    if not results.multi_hand_landmarks:
        return None
    lm = results.multi_hand_landmarks[0].landmark
    features = []
    for p in lm:
        features.extend([p.x, p.y, p.z])
    return np.array(features, dtype=np.float32)

def build_or_load_cache(dataset_dir, force_extract=False, min_detection_confidence=0.5):
    dataset_dir = Path(dataset_dir)
    if os.path.exists(CACHE_PATH) and not force_extract:
        print(f"Loading cached features from {CACHE_PATH}")
        data = np.load(CACHE_PATH, allow_pickle=True)
        X = data["X"]
        y = data["y"]
        counts = json.loads(data["counts"].item())
        return X, y, counts

    print("Extracting landmarks from images (this may take a while)...")
    X_list = []
    y_list = []
    counts = defaultdict(int)

    hands = mp_hands.Hands(static_image_mode=True, max_num_hands=1, min_detection_confidence=min_detection_confidence)

    classes = sorted([d for d in dataset_dir.iterdir() if d.is_dir()])
    for class_dir in classes:
        label = class_dir.name
        files = sorted(class_dir.glob("*"))
        for fp in tqdm(files, desc=f"Processing {label}", unit="img"):
            try:
                img = cv2.imread(str(fp))
                if img is None:
                    continue
                feat = extract_landmarks_from_image(img, hands)
                if feat is None:
                    continue
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

    # Save cache
    os.makedirs(os.path.dirname(CACHE_PATH), exist_ok=True)
    np.savez_compressed(CACHE_PATH, X=X, y=y, counts=json.dumps(counts))
    print(f"Wrote landmark cache to {CACHE_PATH}")
    return X, y, counts

def main(args):
    dataset_dir = args.dataset
    if not os.path.isdir(dataset_dir):
        raise FileNotFoundError(f"Dataset folder not found: {dataset_dir}")

    X, y, counts = build_or_load_cache(Path(dataset_dir), force_extract=args.force_extract,
                                      min_detection_confidence=args.min_detection_confidence)

    print("Extracted sample counts (per class):")
    for k, v in sorted(counts.items()):
        print(f"  {k}: {v}")

    classes_to_keep = [c for c, cnt in counts.items() if cnt >= args.min_samples_per_class]
    if len(classes_to_keep) == 0:
        raise RuntimeError("No classes have enough samples. Lower --min_samples_per_class or re-extract with lower detection confidence.")
    keep_mask = np.isin(y, classes_to_keep)
    X = X[keep_mask]
    y = y[keep_mask]

    # Save class map
    class_list = sorted(list(set(y)))
    class_map = {label: int(idx) for idx, label in enumerate(class_list)}
    os.makedirs(os.path.dirname(CLASS_MAP_PATH), exist_ok=True)
    with open(CLASS_MAP_PATH, "w") as f:
        json.dump(class_map, f, indent=2)
    print(f"Wrote class index map to {CLASS_MAP_PATH}")

    # Train/test split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.15, random_state=42, stratify=y)

    # Train using your repo model
    model = get_model()
    print("Training model on all extracted features (this will call model.save())...")
    model.train(X_train, y_train)
    print("Training complete and model saved.")

    # Evaluate
    X_test_scaled = model.scaler.transform(X_test)
    preds = model.model.predict(X_test_scaled)
    print("Classification report (test set):")
    print(classification_report(y_test, preds, zero_division=0))
    cm = confusion_matrix(y_test, preds, labels=class_list)
    print("Confusion matrix (rows=true, cols=pred):")
    print(cm)
    print("Done.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dataset", required=True, help="Path to dataset root (subfolders per-label)")
    parser.add_argument("--min_samples_per_class", type=int, default=30, help="Minimum good samples per class")
    parser.add_argument("--force-extract", action="store_true", help="Ignore cache and re-extract landmarks from images")
    parser.add_argument("--min-detection-confidence", dest="min_detection_confidence", type=float, default=0.5,
                        help="MediaPipe min_detection_confidence (0..1). Lower to detect harder images.")
    args = parser.parse_args()
    main(args)