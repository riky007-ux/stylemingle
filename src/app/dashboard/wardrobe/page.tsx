'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';

const TOKEN_KEY = 'authToken';

export default function WardrobePage() {
  const router = useRouter();
  const [items, setItems] = useState<string[]>([]);
  const [addedMessage, setAddedMessage] = useState('');
  // Refs for inputs
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const libraryInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      router.replace('/login');
      return;
    }
    const stored = localStorage.getItem(`wardrobe_${token}`);
    if (stored) {
      try {
        const list = JSON.parse(stored);
        setItems(list);
      } catch {
        // ignore parse errors
      }
    }
  }, [router]);

  const handleTakePhotoClick = () => {
    cameraInputRef.current?.click();
  };

  const handleChooseLibraryClick = () => {
    libraryInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      return;
    }
    const img = new Image();
    img.onload = () => {
      const maxDim = 1024;
      let { width, height } = img;
      if (width > height) {
        if (width > maxDim) {
          height = height * (maxDim / width);
          width = maxDim;
        }
      } else {
        if (height > maxDim) {
          width = width * (maxDim / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setAddedMessage('Failed to process image.');
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setItems(prev => {
        const newItems = [...prev, compressedDataUrl];
        try {
          const token = localStorage.getItem(TOKEN_KEY);
          if (token) {
            localStorage.setItem(`wardrobe_${token}`, JSON.stringify(newItems));
          }
          setAddedMessage('Item added and saved!');
          setTimeout(() => {
            setAddedMessage('');
          }, 2000);
          return newItems;
        } catch {
          setAddedMessage('Image too large to save on this device. Please try a smaller photo.');
          return prev;
        }
      });
    };
    img.onerror = () => {
      setAddedMessage('Failed to process image.');
    };
    const reader = new FileReader();
    reader.onload = () => {
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
    (e.target as HTMLInputElement).value = '';
  };

  const handleLogout = () => {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // ignore
    }
    router.replace('/login');
  };

  return (
    <main className="p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-semibold">Wardrobe</h1>
        <button
          onClick={handleLogout}
          className="px-4 py-2 bg-red-500 text-white rounded"
        >
          Logout
        </button>
      </div>
      <div className="flex space-x-2 mb-2">
        <button
          onClick={handleTakePhotoClick}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Take Photo
        </button>
        <button
          onClick={handleChooseLibraryClick}
          className="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Choose from Library
        </button>
      </div>
      {addedMessage && (
        <p className="mb-2 text-sm text-green-600">{addedMessage}</p>
      )}
      <p className="mb-4 text-sm text-gray-600">
        Your wardrobe items are saved on this device.
      </p>
      <input
        type="file"
        accept="image/*"
        capture="environment"
        ref={cameraInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <input
        type="file"
        accept="image/*"
        ref={libraryInputRef}
        className="hidden"
        onChange={handleFileChange}
      />
      <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 gap-4">
        {items.map((src, idx) => (
          <div
            key={idx}
            className="w-full aspect-square overflow-hidden rounded"
          >
            <img
              src={src}
              alt={`Item ${idx}`}
              className="w-full h-full object-cover"
            />
          </div>
        ))}
      </div>
    </main>
  );
}
