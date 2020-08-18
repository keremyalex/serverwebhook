"user strict"

require('dotenv').config()

const express = require('express')
const app = express()
const port = process.env.PORT || 3000

const request = require('request')

const dialogflow = require('dialogflow')
const bodyParser = require('body-parser')
const uuid = require('uuid')
const cred = require("./credential.json");
const admin = require('firebase-admin');


app.use(bodyParser.urlencoded({extended:false}))
app.use(bodyParser.json())

//Credencial de firebase
var serviceAccount = require("./credential2.json");

//Inicializar firebase
admin.initializeApp({
	credential: admin.credential.cert(serviceAccount),
  	databaseURL: process.env.FIREBASE_DATABASE
});

//Credencial Dialogflow
const credential = {
    client_email: cred.client_email,
    private_key: cred.private_key
}

const sessionClient = new dialogflow.SessionsClient({
    projectId: cred.project_id,
    credential
})

//Verificacion del webhook de Facebook
app.get('/webhook', function (req, res) {

    if(req.query["hub.verify_token"] == process.env.FB_VERIFY_TOKEN){
        res.send(req.query["hub.challenge"]);
    }
    
} )

//Traer los mensajes de Facebook

app.post('/webhook', (req, res) => {  
 
    let body = req.body;
  
    if (body.object === 'page') {
  
      body.entry.forEach(function(entry) {
  
        let webhook_event = entry.messaging[0];
        console.log(webhook_event);
        //Enviar el mensaje de Facebook para procesar
        enviarFirebase(webhook_event.sender.id, webhook_event.message.text)
      });

      res.status(200).send('EVENT_RECEIVED');
    } else {
      res.sendStatus(404);
    }
  
  });


async function enviarFirebase(sessionId, text) {

    const projectId = cred.project_id

    const sessionPath = sessionClient.sessionPath(projectId, sessionId);
  
    const request = {
      session: sessionPath,
      queryInput: {
        text: {
          text: text,
          languageCode: 'es',
        },
      },
    };
    

    const responses = await sessionClient.detectIntent(request);
    console.log('Detected intent');
    const result = responses[0].queryResult;
    
    console.log(`  Query: ${result.queryText}`);
    console.log(`  Response: ${result.fulfillmentText}`);
    console.log(result.fulfillmentText)
    console.log(result.action)
 
    if (result.intent) {
      console.log(`  Intent: ${result.intent.displayName}`);
    } else {
      console.log(`  No intent matched.`);
    }
    //Preguntar por la accion de Dialogflow para preguntar en firebase
    if(result.action=="numero"){
        console.log("Este es un numero")
        numeroCelular(sessionId,result.queryText)
    }
    //Enviar a Facebook la respuesta de Dialogflow
    sendText(sessionId, result.fulfillmentText)
    
  }

//Responder en Facebook
  function sendText(id, message){
    request({
        url: "https://graph.facebook.com/v2.10/me/messages",
        qs: {access_token: process.env.FB_ACCESS_TOKEN},
        method: "POST",
        json:{
            recipient: {id:id},
            message:{text: message}
        }
    }, function(error, response, body){
        if(error){
            console.log("Error mandando mensaje " + response.error)
        }
    }
    );
}

//Consulta en Firebase
function numeroCelular(sessionId, numero) {
    var texto
    var ref = admin.database().ref(numero).once('value').then((snapshot)=>{
    	const value = snapshot.child('nombre').val();
      	const codigo = snapshot.child('codigo').val();
        const correo = snapshot.child('correo').val();
        const direccion = snapshot.child('direccion').val();
        const telefono = snapshot.child('telefono').val();
      
      	if(value !== null){
        	texto = `Tus datos son los siguientes: tu codigo es ${codigo}, 
tu nombre es ${value}, tu correo es ${correo}, tu direccion es ${direccion}, tu telefono es ${telefono}`;
            
        }else{
            texto = 'El numero no esta registrado'
        }
        sendText(sessionId, texto)
    });
    //console.log(texto)
    return null; 
  } 





app.get('/', (req, res) => res.send('Hello World!'))
app.listen(port, () => console.log(`La app se encuentra activa en el puerto ${port}`))