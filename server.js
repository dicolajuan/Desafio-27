const { insertDocuments, readDocuments, readOneDocument } = require('./Controllers/functionsCRUD-Mongo.js');
const routes = require('./routes');
const express = require('express');
const handlebars = require('express-handlebars');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const session = require('express-session');
const MongoStore = require('connect-mongo');
const passport = require('passport');
const { obtenerUsuarioId, obtenerUsuario } = require('./utils/util');
const advancedOptions = {useNewUrlParser: true, useUnifiedTopology: true};
const FacebookStrategy = require('passport-facebook').Strategy;
const https = require('https');
const fs = require('fs'); 
const httpsOptions = {
    key: fs.readFileSync('./sslcert/cert.key'),
    cert: fs.readFileSync('./sslcert/cert.pem')
}


const objProductos = [];
const objMensajes = [];
const PORT = 8443;

app.use(express.static('./public'));
app.use(express.json());
app.use(express.urlencoded({extended: true}));
app.use(session({
    secret: 'secreto',
    resave: true,
    saveUninitialized: true,
    rolling: true,
    cookie: { expires: 60000 },
    store: MongoStore.create({
        mongoUrl: 'mongodb+srv://admin:admin@cluster0.adopj.mongodb.net/myFirstDatabase?retryWrites=true&w=majority',
        mongoOptions: advancedOptions
    })
}));

app.use(passport.initialize());
app.use(passport.session());

app.engine(
    "hbs",
    handlebars({
        extname: ".hbs",
        defaultLayout: "index.hbs",
        layoutsDir: "./views/layouts",
        partialsDir: "./views/partials"
    })
);
    
app.set('views', './views'); // especifica el directorio de vistas
app.set('view engine', 'hbs'); // registra el motor de plantillas


const server = https.createServer(httpsOptions, app)
    .listen(PORT, async () => {
        let productosMongo = await readDocuments('productos');
        productosMongo.forEach(prod => {
            objProductos.push(prod);
        });

        let mensajesMongo = await readDocuments('mensajes');
        mensajesMongo.forEach(mens => {
            objMensajes.push(mens);
        });

        console.log(objMensajes);

        console.log(`Servidor escuchando https://localhost:${PORT}/`);
    })
server.on('error', error=>console.log('Error en servidor', error));

passport.serializeUser((user, done)=>{
    done(null, user.id);
});

passport.deserializeUser(async(id, done)=>{
    let user = await obtenerUsuarioId(id);
    done(null, user);
}); 


io.on ('connection', async (socket) => {
    console.log('Usuario conectado');

    socket.emit('productCatalog', { products: objProductos});
    socket.on('newProduct', async (data) => {
        insertDocuments(data,'productos');
        objProductos.push(data);
        io.sockets.emit('productCatalog', { products: objProductos});
    });

    socket.emit('mensajes', objMensajes);
    socket.on('nuevo-mensaje', async (data)=>{
        insertDocuments(data,'mensajes');
        objMensajes.push(data);
        io.sockets.emit('mensajes', objMensajes);
    });

});

passport.use(new FacebookStrategy({
    clientID: '863805684308314',
    clientSecret: '3cb9f9791fe20ac81d3305c228bd77df',
    callbackURL: `https://localhost:${PORT}/auth/facebook/datos`,
    profileFields: ['id', 'displayName', 'email', 'picture']
  },
  async function(accessToken, refreshToken, profile, cb) {
      let usuario = await obtenerUsuario(profile.id);
      if (usuario == null) {
        let usuario = {
            id: profile.id,
            username: profile.displayName,
            picture: profile._json.picture

        };
        await insertDocuments(usuario,'usuarios');
        console.log('nuevo', usuario);
        cb(null,usuario);
      } else {
          console.log('encontre: ', usuario);
          cb(null,usuario);
      }

  }
));


app.get('/auth/facebook',
  passport.authenticate('facebook'));

app.get('/auth/facebook/datos',
  passport.authenticate('facebook', { failureRedirect: '/failLogin' }),
  function(req, res) {
    // Successful authentication, redirect home.
    res.redirect('/');
  });

app.get('/', checkAuthentication, routes.getInicio);
app.get('/home', checkAuthentication, (req,res) => {
    // console.log(objProductos);
    res.render('products', { products: objProductos, userName: req.user.username, picture: req.user.picture.data.url});
});

app.get('/register', routes.getRegister);
app.post('/register', passport.authenticate('signup', {failureRedirect:'/falloRegister'}), routes.postRegister);
app.get('/falloRegister', routes.getRegisterFail);

app.get('/login', routes.getLogin);
app.post('/login', passport.authenticate('login', {failureRedirect: '/failLogin'}), routes.postLogin);
app.get('/failLogin', routes.getFailLogin);

app.get('/logout', routes.getLogout);

function checkAuthentication(req, res, next){
    if (req.isAuthenticated()){
        next();
    } else {
        res.redirect('/auth/facebook');
    }
}