const fs = require('fs') //we need this to read our keys. Part of node
const https = require('https') //we need this for a secure express server. part of node
//express sets up the http server and serves our front end
const express = require('express')
const app = express()
//seve everything in public statically
app.use(express.static('public'))

//get the keys we made with mkcert
const key = fs.readFileSync('./config/cert.key')
const cert = fs.readFileSync('./config/cert.crt')
const options = {key,cert}
//use those keys with the https module to have https
const httpsServer = https.createServer(options, app)

const socketio = require('socket.io')
const mediasoup = require('mediasoup')

const config = require('./config/config')
const createWorkers = require('./createWorkers')
const createWebRtcTransportBothKinds = require('./createWebRtcTransportBothKinds')

//set up the socketio server, listening by way of our express https sever
const io = socketio(httpsServer,{
    cors: [`https://localhost:${config.port}`],
    cors: [`https://192.168.1.44`]
})

//our globals
//init workers, it's where our mediasoup workers will live
let workers = null
// init router, it's where our 1 router will live
let router = null
// theProducer will be a global, and whoever produced last
let theProducer = null

//initMediaSoup gets mediasoup ready to do its thing
const initMediaSoup = async()=>{
    workers = await createWorkers()
    // console.log(workers)
    router = await workers[0].createRouter({
        mediaCodecs: config.routerMediaCodecs
    })
}

initMediaSoup() //build our mediasoup server/sfu

// socketIo listeners
io.on('connect', socket=>{
    let thisClientProducerTransport = null
    let thisClientProducer = null
    let thisClientConsumerTransport = null
    let thisClientConsumer = null    
    // socket is the client that just connected
    // changed cb to ack, because cb is too generic
    // ack stand for acknowledge, and is a callback
    socket.on('getRtpCap',ack=>{
        // ack is a callback to run, that will send the args
        // back to the client
        ack(router.rtpCapabilities)
    })
    socket.on('create-producer-transport', async ack=>{
        // create a transport! A producer transport
        const {transport,clientTransportParams} = await createWebRtcTransportBothKinds(router)
        thisClientProducerTransport = transport
        ack(clientTransportParams) //what we send back to the client
    })
    socket.on('connect-transport',async(dtlsParameters, ack)=>{
        //get the dtls info from the client, and finish the connection
        // on success, send success, on fail, send error
        try{
            await thisClientProducerTransport.connect(dtlsParameters)
            ack("success")
        }catch(error){
            // something went wrong. Log it, and send back "err"
            console.log(error)
            ack("error")
        }
    })
    socket.on('start-producing',async({kind, rtpParameters}, ack)=>{
        try{
            thisClientProducer = await thisClientProducerTransport.produce({kind, rtpParameters})
            theProducer = thisClientProducer
            thisClientProducer.on('transportclose',()=>{
                console.log("Producer transport closed. Just fyi")
                thisClientProducer.close()
            })            
            ack(thisClientProducer.id)
        }catch(error){
            console.log(error)
            ack("error")
        }
    })
    socket.on('create-consumer-transport', async ack=>{
        // create a transport! A producer transport
        const {transport,clientTransportParams} = await createWebRtcTransportBothKinds(router)
        thisClientConsumerTransport = transport
        ack(clientTransportParams) //what we send back to the client
    })    
    socket.on('connect-consumer-transport',async(dtlsParameters, ack)=>{
        //get the dtls info from the client, and finish the connection
        // on success, send success, on fail, send error
        try{
            await thisClientConsumerTransport.connect(dtlsParameters)
            ack("success")
        }catch(error){
            // something went wrong. Log it, and send back "err"
            console.log(error)
            ack("error")
        }
    })
    socket.on('consume-media',async({rtpCapabilities},ack)=>{
        // we will set up our clientConsumer, and send back
        // the params the client needs to do the same
        // make sure there is a producer :) we can't consume without one
        if(!theProducer){
            ack("noProducer")
        }else if(!router.canConsume({producerId:theProducer.id,rtpCapabilities})){
            ack("cannotConsume")
        }else{
            // we can consume... there is a producer and client is able.
            // proceed!
            thisClientConsumer = await thisClientConsumerTransport.consume({
                producerId: theProducer.id,
                rtpCapabilities,
                paused: true, //see docs, this is usually the best way to start
            })
            thisClientConsumer.on('transportclose',()=>{
                console.log("Consumer transport closed. Just fyi")
                thisClientConsumer.close()
            })
            const consumerParams = {
                producerId: theProducer.id,
                id: thisClientConsumer.id,
                kind:thisClientConsumer.kind,
                rtpParameters: thisClientConsumer.rtpParameters,
            }   
            ack(consumerParams)
        }
    })
    socket.on('unpauseConsumer',async ack=>{
        await thisClientConsumer.resume()
    })
    socket.on('close-all',ack=>{
        // client has requested to close ALL
        try{
            thisClientConsumerTransport?.close()
            thisClientProducerTransport?.close()
            ack("closed")
        }catch(error){
            ack("closeError")
        }
    })
})

httpsServer.listen(config.port)