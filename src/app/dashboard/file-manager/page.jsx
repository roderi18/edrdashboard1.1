'use client';

import dynamic from 'next/dynamic';

const FileManagerView = dynamic(
  () =>
    import('src/sections/file-manager/view/file-manager-view').then(
      (m) => m.FileManagerView
    ),
  { ssr: false }
);

export default function Page() {
  return <FileManagerView />;
}
