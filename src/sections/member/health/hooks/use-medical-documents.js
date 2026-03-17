import { useCallback, useRef, useState } from 'react';
import { toast } from 'src/components/snackbar';
import { MEDICAL_DOCUMENTS } from 'src/_mock/health';

export function useMedicalDocuments({ memberId, table }) {
    const [medicalDocuments, setMedicalDocuments] = useState(() =>
        MEDICAL_DOCUMENTS.filter((doc) => doc.memberId === memberId)
    );

    const INVALID_NAME_REGEX = /[\\/:*?"<>|]/;

    const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

    const ALLOWED_EXTENSIONS = [
        'pdf',
        'jpg',
        'jpeg',
        'png',
        'webp',
        'doc',
        'docx',
        'xls',
        'xlsx',
        'csv',
    ];


    // -----------------------------
    // INPUT FILE (ref)
    // -----------------------------
    const fileInputRef = useRef(null);

    // -----------------------------
    // ABRIR SELECTOR
    // -----------------------------
    const openUploadDialog = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    // -----------------------------
    // MANEJAR ARCHIVOS
    // -----------------------------
    const handleUploadFiles = useCallback(
        (event) => {
            const files = Array.from(event.target.files || []);
            if (!files.length) return;

            const validFiles = [];
            const rejectedFiles = [];

            const existingNames = new Set(
                medicalDocuments.map((doc) => doc.name.toLowerCase())
            );

            const batchNames = new Set();

            files.forEach((file) => {
                const cleanName = file.name.trim();
                const cleanNameLower = cleanName.toLowerCase();
                const ext = cleanName.split('.').pop().toLowerCase();

                // nombre vacío
                if (!cleanName) {
                    rejectedFiles.push('Nombre vacío no permitido');
                    return;
                }

                // caracteres inválidos
                if (INVALID_NAME_REGEX.test(cleanName)) {
                    rejectedFiles.push(
                        `${file.name} (contiene caracteres no permitidos)`
                    );
                    return;
                }

                // extensión no permitida
                if (!ALLOWED_EXTENSIONS.includes(ext)) {
                    rejectedFiles.push(
                        `${file.name} (extensión no permitida)`
                    );
                    return;
                }

                // tamaño excedido
                if (file.size > MAX_FILE_SIZE) {
                    rejectedFiles.push(
                        `${file.name} (supera 2 MB)`
                    );
                    return;
                }

                // duplicado contra documentos existentes
                if (existingNames.has(cleanNameLower)) {
                    rejectedFiles.push(
                        `${file.name} (ya existe un documento con ese nombre)`
                    );
                    return;
                }

                // duplicado dentro de la misma selección
                if (batchNames.has(cleanNameLower)) {
                    rejectedFiles.push(
                        `${file.name} (archivo duplicado en la selección)`
                    );
                    return;
                }

                // marcar como usado en este batch
                batchNames.add(cleanNameLower);

                validFiles.push({
                    file,
                    cleanName,
                });
            });


            if (rejectedFiles.length) {
                toast.error(
                    `No se cargó:\n${rejectedFiles.join('\n')}`
                );
            }

            if (!validFiles.length) {
                event.target.value = '';
                return;
            }

            const getFileType = (fileName) => {
                const ext = fileName.split('.').pop().toLowerCase();

                if (ext === 'pdf') return 'pdf';
                if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return 'image';
                if (['doc', 'docx'].includes(ext)) return 'word';
                if (['xls', 'xlsx', 'csv'].includes(ext)) return 'excel';

                return 'file';
            };

            const newDocs = validFiles.map(({ file, cleanName }) => ({
                id: crypto.randomUUID(),
                memberId,

                name: cleanName,
                size: file.size,
                modifiedAt: new Date(),

                type: getFileType(cleanName),

                tags: [],
                shared: [],
                url: '',
            }));


            setMedicalDocuments((prev) => [...prev, ...newDocs]);

            event.target.value = '';
            toast.success(`${validFiles.length} documento(s) cargado(s)`);
        },
        [memberId, medicalDocuments]
    );

    // -----------------------------
    // COMPONENTE INPUT (AQUÍ ESTÁ LA CLAVE)
    // -----------------------------
    const FileInput = (
        <input
            ref={fileInputRef}
            type="file"
            hidden
            multiple
            onChange={handleUploadFiles}
        />
    );

    // -----------------------------
    // ELIMINAR UNO
    // -----------------------------
    const deleteOne = useCallback((id) => {
        setMedicalDocuments((prev) => prev.filter((doc) => doc.id !== id));
        toast.success('Documento eliminado');
    }, []);

    // -----------------------------
    // ELIMINAR SELECCIONADOS
    // -----------------------------
    const deleteSelected = useCallback(() => {
        if (!table.selected.length) return;

        setMedicalDocuments((prev) =>
            prev.filter((doc) => !table.selected.includes(doc.id))
        );

        table.onResetPage();
        table.onSelectAllRows(false, []);

        toast.success(`${table.selected.length} documentos eliminados`);
    }, [table]);

    const removeAll = useCallback(() => {
        setMedicalDocuments([]);
        toast.success('Documentos eliminados');
    }, []);

    const renameDocument = useCallback(
        (id, newBaseName) => {
            const cleanBaseName = newBaseName.trim();

            // nombre vacío
            if (!cleanBaseName) {
                toast.error('El nombre no puede estar vacío');
                return false;
            }

            // caracteres inválidos
            if (INVALID_NAME_REGEX.test(cleanBaseName)) {
                toast.error('El nombre contiene caracteres no permitidos');
                return false;
            }

            let renamed = false;

            setMedicalDocuments((prev) => {
                const currentDoc = prev.find((doc) => doc.id === id);
                if (!currentDoc) return prev;

                const finalName =
                    currentDoc.type === 'folder'
                        ? cleanBaseName
                        : `${cleanBaseName}.${currentDoc.name.split('.').pop()}`;

                const finalNameLower = finalName.toLowerCase();

                // duplicado (excluyendo el mismo doc)
                const duplicated = prev.some(
                    (doc) =>
                        doc.id !== id &&
                        doc.name.toLowerCase() === finalNameLower
                );

                if (duplicated) {
                    toast.error('Ya existe un documento con ese nombre');
                    return prev;
                }

                renamed = true;

                return prev.map((doc) =>
                    doc.id === id
                        ? {
                            ...doc,
                            name: finalName,
                            modifiedAt: new Date(),
                        }
                        : doc
                );
            });

            if (renamed) {
                toast.success('Nombre actualizado');
            }

            return renamed;
        },
        [INVALID_NAME_REGEX]
    );

    return {
        medicalDocuments,
        openUploadDialog,
        FileInput,
        deleteOne,
        deleteSelected,
        removeAll,
        renameDocument,
    };
}
