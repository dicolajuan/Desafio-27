let mongoose = require('mongoose');
const usuariosCollection = 'usuarios';

const UsuarioEsquema = mongoose.Schema({
    id: {type: String, require: true, unique: true},
    username: {type: String, require: true},
    picture: {type: Object, require: true}
});

const Usuario = mongoose.model(usuariosCollection, UsuarioEsquema);

module.exports = { Usuario };