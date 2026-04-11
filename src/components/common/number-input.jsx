import { useFormContext } from 'react-hook-form';
import { Field } from 'src/components/hook-form';

export default function NumberInput({
    name = 'number',
    label = 'Número',
    maxLength = 3,
}) {
    const { setValue, watch } = useFormContext();

    const value = watch(name) || '';

    return (
        <Field.Text
            name={name}
            label={label}
            value={value}
            inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*',
            }}
            onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '').slice(0, maxLength);

                setValue(name, val, {
                    shouldValidate: true,
                    shouldDirty: true,
                });
            }}
        />
    );
}