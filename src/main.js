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

import { mqtt, iot } from 'aws-iot-device-sdk-v2'

import { TextDecoder } from 'util'
const decoder = new TextDecoder('utf-8');

const rpio = require('rpio');

var fs = require('fs');

async function main() {
    rpio.spiBegin();

    let mqttClientConfig = {
        hostUrl: process.env.SOLACE_MQTT_HOST_URL,
        username: process.env.SOLACE_USERNAME,
        password: process.env.SOLACE_PASSWORD,
        clientId: process.env.MQTT_CLIENT_ID,
    };

    console.log("=== Starting MQTT producer ===");

    let mqttClientSolace;
    let mqttClientAWS;
    let mqttClientAWSConnection;

    try {
        mqttClientSolace = MqttClient(mqttClientConfig);
        console.log("Connecting MQTT client to Solace...");
        await mqttClientSolace.connect();
        console.log("MQTT client connected to Solace.");
    } catch (err) {
        console.error(err);
        process.exit();
    }

    try {
        let config_builder = iot.AwsIotMqttConnectionConfigBuilder
            .new_mtls_builder_from_path(
                `${__dirname}/../credentials/63fdd4ca9f62a048adced6dbc2616b9d5d3ed41b7d54429da6c6f879d232ba4f-certificate.pem.crt`,
                `${__dirname}/../credentials/63fdd4ca9f62a048adced6dbc2616b9d5d3ed41b7d54429da6c6f879d232ba4f-private.pem.key`
            );
        config_builder.with_certificate_authority_from_path(
            undefined,
            `${__dirname}/../credentials/AmazonRootCA1.crt`
        );

        config_builder.with_clean_session(false);
        config_builder.with_client_id('IoT_System_Client_Jisu');
        config_builder.with_endpoint('a2q6vmsmhirxv-ats.iot.ap-northeast-1.amazonaws.com');

        const config = config_builder.build();

        mqttClientAWS = new mqtt.MqttClient();
        mqttClientAWSConnection = mqttClientAWS.new_connection(config);

        console.log('Connecting to AWS client...')
        await mqttClientAWSConnection.connect();
        console.log('Connected');

        console.log('Subscribing...');
        await mqttClientAWSConnection.subscribe('pi',
            mqtt.QoS.AtLeastOnce,
            (topic, payload, dup, qos, retain) => {
                const jsonStr = decoder.decode(payload);
                const json = JSON.parse(jsonStr);
                const imageRaw = json.image;

                fs.writeFileSync('./test.jpg', imageRaw, 'base64');

                console.log(`from aws, payload: ${imageRaw}`);
            }
        );
        console.log('Subscribed.');
    } catch (err) {
        console.error(err);
        process.exit();
    }

    const topic = 'PHOTO';

    while (true) {
        let channel = 0;
        let sendBuffer = Buffer.from([0x01, (8 + channel << 4), 0x01]);
        let receiveBuffer = Buffer.alloc(3);
        rpio.spiTransfer(sendBuffer, receiveBuffer, sendBuffer.length);

        const ILLUMINANCE_THRES = 700;
        let illuminance = ((receiveBuffer[1] & 0x03) << 8) + receiveBuffer[2];

        console.log(`Illuminance: ${illuminance}`);

        if (illuminance > ILLUMINANCE_THRES) {
            const dataJson = JSON.stringify({
                "illuminance": illuminance,
            });

            console.log(`Topic = ${topic}, Data = ${dataJson}`);
            mqttClientSolace.send(topic, dataJson, 2);
        }
        
        await new Promise((res) => setTimeout(res, 1000));
    }
}

main();
