// Sustituto de `server-only` en las pruebas: ese paquete existe solo para que el
// empaquetador avise si un modulo de servidor acaba en el cliente, y fuera de
// Next lanza una excepcion al importarse. Aqui no hay empaquetador que avisar.
export default {};
