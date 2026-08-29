'use client';

import { FormProvider as RHFForm } from 'react-hook-form';

import { useFormDraft } from './use-form-draft';
import { FormDraftNotice } from './form-draft-notice';

// ----------------------------------------------------------------------

/**
 * El envoltorio por el que pasan TODOS los formularios de la aplicacion.
 *
 * `borrador` es opcional y es lo que hace que lo escrito sobreviva a un F5 o a
 * cerrar la aplicacion. Se pasa una clave que identifique el formulario Y la
 * entidad —'seccion:12', 'destacamento:nuevo'— porque el borrador de una ficha
 * no se puede abrir dentro de otra. Cada persona ve el suyo: la clave real lleva
 * su uid (ver `use-form-draft`).
 *
 * Sin la prop, el formulario se comporta como siempre y no guarda nada. Es a
 * proposito: un formulario de busqueda o un filtro no tiene borrador que
 * ofrecer, y un formulario con datos personales no debe guardarlo hasta que se
 * filtren los campos enmascarados.
 */
export function Form({ children, onSubmit, methods, borrador = '' }) {
  const { borrador: guardado, recuperar, descartar } = useFormDraft(methods, borrador);

  return (
    <RHFForm {...methods}>
      <form onSubmit={onSubmit} noValidate autoComplete="off">
        <FormDraftNotice borrador={guardado} onRecuperar={recuperar} onDescartar={descartar} />
        {children}
      </form>
    </RHFForm>
  );
}
