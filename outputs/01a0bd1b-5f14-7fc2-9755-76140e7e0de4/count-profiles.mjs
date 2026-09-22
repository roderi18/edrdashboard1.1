import { PERFILES_DIRECTIVA_NACIONAL_2022_2026 as p } from '../../src/catalogs/directiva-perfil-2022-2026.mjs';
const rows = Object.values(p);
console.log(JSON.stringify({total:rows.length,nacional:rows.filter(x=>x.nivel==='nacional').length,nacionalProvisional:rows.filter(x=>x.nivel==='nacional'&&x.seccionPropuesta==='Provisional').length,excluidos:rows.filter(x=>x.cargoExcluido).length,excluidosConCargo:rows.filter(x=>x.cargoExcluido&&x.cargoNacional).length,preexistentes:rows.filter(x=>String(x.existiaAntes).startsWith('Sí')).length}));
