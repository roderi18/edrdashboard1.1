import { useRef, useMemo, useState, useEffect, useCallback } from 'react';

import {
  subirDocumentosSaludMiembro,
  listarDocumentosSaludMiembro,
  eliminarDocumentoSaludMiembro,
  renombrarDocumentoSaludMiembro,
} from 'src/services/member-health-documents-service';

import { toast } from 'src/components/snackbar';

import { useAuthContext } from 'src/auth/hooks';
import { can, PERMISOS } from 'src/auth/permissions';

export function useMedicalDocuments({ memberId, codigoMiembro = '', table }) {
  const { user } = useAuthContext();
  // Eliminar documentos del perfil de salud requiere el permiso explicito
  // "documentos.eliminar". Los roles de nivel (Coordinador de Destacamento,
  // Coordinador Seccional, Director Regional) NO lo tienen, por lo que no
  // pueden borrar estos documentos sensibles.
  const canDeleteDocuments = can(user, PERMISOS.DOCUMENTOS_ELIMINAR);
  const [medicalDocuments, setMedicalDocuments] = useState([]);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);
  const uploadCategoryRef = useRef('otros_documentos');
  const invalidNameRegex = useMemo(() => /[\\/:*?"<>|]/, []);
  const maxFileSize = 10 * 1024 * 1024;
  const allowedExtensions = useMemo(
    () => ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'doc', 'docx', 'xls', 'xlsx', 'csv'],
    []
  );

  useEffect(() => {
    let active = true;

    const loadDocuments = async () => {
      if (!memberId) return;

      setLoading(true);

      try {
        const documents = await listarDocumentosSaludMiembro(memberId);

        if (active) {
          setMedicalDocuments(documents);
        }
      } catch (error) {
        console.error(error);
        toast.error('No se pudieron cargar los documentos de salud.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDocuments();

    return () => {
      active = false;
    };
  }, [memberId]);

  const openUploadDialog = useCallback((documentCategory = 'otros_documentos') => {
    uploadCategoryRef.current = documentCategory;
    fileInputRef.current?.click();
  }, []);

  const validateFiles = useCallback(
    (files = []) => {
      const existingNames = new Set(medicalDocuments.map((doc) => doc.name.toLowerCase()));
      const batchNames = new Set();
      const validFiles = [];
      const rejectedFiles = [];

      files.forEach((file) => {
        const cleanName = file.name.trim();
        const cleanNameLower = cleanName.toLowerCase();
        const ext = cleanName.split('.').pop().toLowerCase();

        if (!cleanName) {
          rejectedFiles.push('Nombre vacío no permitido');
          return;
        }

        if (invalidNameRegex.test(cleanName)) {
          rejectedFiles.push(`${file.name} (contiene caracteres no permitidos)`);
          return;
        }

        if (!allowedExtensions.includes(ext)) {
          rejectedFiles.push(`${file.name} (extensión no permitida)`);
          return;
        }

        if (file.size > maxFileSize) {
          rejectedFiles.push(`${file.name} (supera 10 MB)`);
          return;
        }

        if (existingNames.has(cleanNameLower)) {
          rejectedFiles.push(`${file.name} (ya existe un documento con ese nombre)`);
          return;
        }

        if (batchNames.has(cleanNameLower)) {
          rejectedFiles.push(`${file.name} (archivo duplicado en la selección)`);
          return;
        }

        batchNames.add(cleanNameLower);
        validFiles.push(file);
      });

      return { validFiles, rejectedFiles };
    },
    [allowedExtensions, invalidNameRegex, maxFileSize, medicalDocuments]
  );

  const uploadFilesForCategory = useCallback(
    async (inputFiles, documentCategory = 'otros_documentos', onFinish) => {
      const files = Array.from(inputFiles || []);

      if (!files.length) return;

      const { validFiles, rejectedFiles } = validateFiles(files);

      if (rejectedFiles.length) {
        toast.error(`No se cargó:\n${rejectedFiles.join('\n')}`);
      }

      if (!validFiles.length) {
        onFinish?.();
        return;
      }

      const optimisticDocuments = validFiles.map((file) => ({
        id: `temp-${crypto.randomUUID()}`,
        idMiembros: Number(memberId),
        codigoMiembro,
        documentCategory,
        tipoDocumentoSalud: documentCategory,
        name: file.name,
        title: file.name,
        size: file.size,
        modifiedAt: new Date().toISOString(),
        type: file.name.split('.').pop().toLowerCase(),
        tags: ['salud'],
        shared: [],
        url: '',
        uploading: true,
      }));

      setMedicalDocuments((prev) => [...optimisticDocuments, ...prev]);

      try {
        const uploadedDocuments = await subirDocumentosSaludMiembro({
          files: validFiles,
          idMiembros: memberId,
          codigoMiembro,
          documentCategory,
          creadoPor: user,
        });
        const optimisticIds = new Set(optimisticDocuments.map((documento) => documento.id));

        setMedicalDocuments((prev) => [
          ...uploadedDocuments,
          ...prev.filter((documento) => !optimisticIds.has(documento.id)),
        ]);
        toast.success(`${uploadedDocuments.length} documento(s) cargado(s)`);
      } catch (error) {
        console.error(error);
        const optimisticIds = new Set(optimisticDocuments.map((documento) => documento.id));

        setMedicalDocuments((prev) => prev.filter((documento) => !optimisticIds.has(documento.id)));
        toast.error(error.message || 'No se pudieron subir los documentos.');
      } finally {
        onFinish?.();
      }
    },
    [codigoMiembro, memberId, user, validateFiles]
  );

  const handleUploadFiles = useCallback(
    async (event) => {
      await uploadFilesForCategory(event.target.files, uploadCategoryRef.current, () => {
        event.target.value = '';
      });
    },
    [uploadFilesForCategory]
  );

  const FileInput = (
    <input ref={fileInputRef} type="file" hidden multiple onChange={handleUploadFiles} />
  );

  const deleteOne = useCallback(
    async (id) => {
      if (!canDeleteDocuments) {
        toast.error('No tienes permiso para eliminar documentos del perfil de salud.');
        return;
      }

      const document = medicalDocuments.find((item) => item.id === id);

      setMedicalDocuments((prev) => prev.filter((item) => item.id !== id));

      try {
        await eliminarDocumentoSaludMiembro(document, user);
        toast.success('Documento eliminado');
      } catch (error) {
        console.error(error);
        setMedicalDocuments((prev) => (document ? [document, ...prev] : prev));
        toast.error('No se pudo eliminar el documento.');
      }
    },
    [canDeleteDocuments, medicalDocuments, user]
  );

  const deleteSelected = useCallback(async () => {
    if (!canDeleteDocuments) {
      toast.error('No tienes permiso para eliminar documentos del perfil de salud.');
      return;
    }

    if (!table.selected.length) return;

    const selectedIds = new Set(table.selected);
    const selectedDocuments = medicalDocuments.filter((doc) => selectedIds.has(doc.id));

    setMedicalDocuments((prev) => prev.filter((doc) => !selectedIds.has(doc.id)));
    table.onResetPage();
    table.onSelectAllRows(false, []);

    try {
      await Promise.all(
        selectedDocuments.map((documento) => eliminarDocumentoSaludMiembro(documento, user))
      );
      toast.success(`${selectedDocuments.length} documentos eliminados`);
    } catch (error) {
      console.error(error);
      setMedicalDocuments((prev) => [...selectedDocuments, ...prev]);
      toast.error('No se pudieron eliminar todos los documentos.');
    }
  }, [canDeleteDocuments, medicalDocuments, table, user]);

  const removeAll = useCallback(() => {
    setMedicalDocuments([]);
    toast.success('Documentos eliminados');
  }, []);

  const renameDocument = useCallback(
    (id, newBaseName) => {
      const cleanBaseName = newBaseName.trim();
      const currentDoc = medicalDocuments.find((doc) => doc.id === id);

      if (!currentDoc) return false;

      if (!cleanBaseName) {
        toast.error('El nombre no puede estar vacío');
        return false;
      }

      if (invalidNameRegex.test(cleanBaseName)) {
        toast.error('El nombre contiene caracteres no permitidos');
        return false;
      }

      const extension = currentDoc.name.split('.').pop();
      const finalName = `${cleanBaseName}.${extension}`;
      const finalNameLower = finalName.toLowerCase();
      const duplicated = medicalDocuments.some(
        (doc) => doc.id !== id && doc.name.toLowerCase() === finalNameLower
      );

      if (duplicated) {
        toast.error('Ya existe un documento con ese nombre');
        return false;
      }

      setMedicalDocuments((prev) =>
        prev.map((doc) =>
          doc.id === id ? { ...doc, name: finalName, title: finalName, modifiedAt: new Date().toISOString() } : doc
        )
      );

      renombrarDocumentoSaludMiembro(currentDoc, finalName, user)
        .then((updatedDocument) => {
          if (updatedDocument) {
            setMedicalDocuments((prev) =>
              prev.map((doc) => (doc.id === id ? { ...doc, ...updatedDocument } : doc))
            );
          }
        })
        .catch((error) => {
          console.error(error);
          setMedicalDocuments((prev) =>
            prev.map((doc) => (doc.id === id ? currentDoc : doc))
          );
          toast.error('No se pudo renombrar el documento.');
        });

      toast.success('Nombre actualizado');
      return true;
    },
    [invalidNameRegex, medicalDocuments, user]
  );

  return {
    loading,
    medicalDocuments,
    canDeleteDocuments,
    openUploadDialog,
    uploadDroppedFiles: uploadFilesForCategory,
    FileInput,
    deleteOne,
    deleteSelected,
    removeAll,
    renameDocument,
  };
}
