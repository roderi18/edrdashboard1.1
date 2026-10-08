import { Controller, useFormContext } from 'react-hook-form';

import Box from '@mui/material/Box';

import { optimizeImageFile } from 'src/utils/image-optimizer';
import {
  getImageOptimizationMessage,
  getImagesOptimizationMessage,
} from 'src/utils/upload-optimization-message';

import { toast } from 'src/components/snackbar';

import { HelperText } from './help-text';
import { Upload, UploadBox, UploadAvatar } from '../upload';

// ----------------------------------------------------------------------

const markOptimizedFile = (file, info) => {
  if (!(file instanceof File)) return file;

  Object.defineProperties(file, {
    __originalSize: {
      value: info.originalSize,
      configurable: true,
    },
    __optimizedForUpload: {
      value: true,
      configurable: true,
    },
    __optimizationInfo: {
      value: info,
      configurable: true,
    },
  });

  return file;
};

const optimizeImageUploadFile = async (file, preset = 'avatar') => {
  if (!(file instanceof File) || !String(file.type || '').startsWith('image/')) {
    return { file, info: null };
  }

  const originalSize = file.__originalSize || file.size || 0;
  const optimizedFile = await optimizeImageFile(file, preset);
  const info = {
    originalSize,
    optimizedSize: optimizedFile?.size || file.size || 0,
  };

  return {
    file: markOptimizedFile(optimizedFile || file, info),
    info,
  };
};

export function RHFUploadAvatar({
  name,
  slotProps,
  onDrop: onDropProp,
  optimizationToast = true,
  maxSize,
  ...other
}) {
  void maxSize;

  const { control, setValue } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const onDrop = async (acceptedFiles) => {
          const { file: value, info } = await optimizeImageUploadFile(acceptedFiles?.[0], 'avatar');

          if (optimizationToast && info) {
            toast.success(getImageOptimizationMessage(info));
          }

          setValue(name, value, { shouldValidate: true });

          const nextValue = await onDropProp?.([value], { field, setValue, optimizationInfo: info });

          if (nextValue) {
            setValue(name, nextValue, { shouldValidate: true });
          }
        };

        return (
          <Box {...slotProps?.wrapper}>
            <UploadAvatar value={field.value} error={!!error} onDrop={onDrop} {...other} />
            <HelperText errorMessage={error?.message} sx={{ justifyContent: 'center' }} />
          </Box>
        );
      }}
    />
  );
}

// ----------------------------------------------------------------------

export function RHFUploadBox({ name, ...other }) {
  const { control } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => (
        <UploadBox value={field.value} error={!!error} {...other} />
      )}
    />
  );
}

// ----------------------------------------------------------------------

export function RHFUpload({
  name,
  multiple,
  helperText,
  maxSize,
  optimizationToast = true,
  optimizationPreset = 'general',
  ...other
}) {
  void maxSize;

  const { control, setValue } = useFormContext();

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState: { error } }) => {
        const uploadProps = {
          multiple,
          accept: { 'image/*': [] },
          error: !!error,
          helperText: error?.message ?? helperText,
        };

        const onDrop = async (acceptedFiles) => {
          const optimizedItems = await Promise.all(
            (acceptedFiles || []).map((file) => optimizeImageUploadFile(file, optimizationPreset))
          );
          const files = optimizedItems.map((item) => item.file).filter(Boolean);
          const value = multiple ? [...(field.value || []), ...files] : files[0];

          if (optimizationToast && optimizedItems.some((item) => item.info)) {
            toast.success(getImagesOptimizationMessage(optimizedItems));
          }

          setValue(name, value, { shouldValidate: true });
        };

        return <Upload {...uploadProps} value={field.value} onDrop={onDrop} {...other} />;
      }}
    />
  );
}
