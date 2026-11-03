import React, { useEffect, useState } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { signedPhotoUrl } from '@/lib/supabase';

/** Renders a photo from the private `photos` bucket via a signed URL. Renders nothing if there is no path or signing fails. */
export function PhotoImage({ path, style }: { path: string | null | undefined; style?: StyleProp<ImageStyle> }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUri(null);
    signedPhotoUrl(path).then((u) => { if (alive) setUri(u); });
    return () => { alive = false; };
  }, [path]);
  return uri ? <Image source={{ uri }} style={style} /> : null;
}
