/**
 * index.js
 * 
 */

// polyfill async
import 'core-js';
import 'regenerator-runtime';
// load env variables
import dotenv from 'dotenv'

let result = dotenv.config();
if (result.error) {
    throw result.error;
}

import MqttClient from './mqtt-client'

var rpio = require('rpio');

async function main() {
    rpio.spiBegin();

    let mqttClientConfig = {
        hostUrl: process.env.SOLACE_MQTT_HOST_URL,
        username: process.env.SOLACE_USERNAME,
        password: process.env.SOLACE_PASSWORD,
        clientId: process.env.MQTT_CLIENT_ID,
    };

    console.log("=== Starting MQTT producer ===");

    let mqttClient;

    try {
        mqttClient = MqttClient(mqttClientConfig);
        console.log("Connecting MQTT client to Solace...");
        await mqttClient.connect();
        console.log("MQTT client connected to Solace.");
    } catch (err) {
        console.error(err);
        process.exit();
    }

    while (true) {
        let channel = 0;
        let sendBuffer = Buffer.from([0x01, (8 + channel << 4), 0x01]);
        let receiveBuffer = Buffer.alloc(3);
        rpio.spiTransfer(sendBuffer, receiveBuffer, sendBuffer.length);

        let value = ((receiveBuffer[1] & 0x03) << 8) + receiveBuffer[2];

        let data = {
            "illuminance": value,
        };
        let dataJson = JSON.stringify(data);

        console.log(`Illuminance: ${dataJson}`);
        mqttClient.send(`${mqttClientConfig.clientId}/ILLUMINANCE`, dataJson);
        
        await new Promise((res) => setTimeout(res, 1000));
    }
}

main();
