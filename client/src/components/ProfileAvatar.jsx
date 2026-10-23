import { useEffect, useRef, useState } from 'react';
import { apiBlob } from '../services/api';

export function ProfileAvatar({ name, className, fallbackClassName = className, alt = '', onError }) {
  const [imageUrl, setImageUrl] = useState('');
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const controller = new AbortController();
    let objectUrl;
    setImageUrl('');
    setLoadError('');

    apiBlob('/student/profile/image', { signal: controller.signal })
      .then((image) => {
        if (!image || controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(image);
        setImageUrl(objectUrl);
      })
      .catch((error) => {
        if (!controller.signal.aborted) {
          setLoadError(error.message);
          onErrorRef.current?.(error.message);
        }
      });

    function refreshImage() {
      setRefreshKey((key) => key + 1);
    }
    window.addEventListener('ssh:profile-image-changed', refreshImage);
    return () => {
      controller.abort();
      window.removeEventListener('ssh:profile-image-changed', refreshImage);
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [refreshKey]);

  const initial = name?.trim()?.slice(0, 1).toUpperCase() || 'S';
  if (imageUrl) return <img className={`${className} profile-avatar-image`} src={imageUrl} alt={alt || `${name || 'Student'} profile picture`} />;
  return <div className={fallbackClassName} title={loadError || undefined} aria-label={loadError ? `Profile picture unavailable: ${loadError}` : undefined}>{initial}</div>;
}
