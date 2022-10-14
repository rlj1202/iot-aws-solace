import mqtt from 'mqtt';
import produce from 'immer';

function MqttClient({ hostUrl, username, password, clientId = username }) {
    let client = null;

    async function connect() {
        return new Promise((resolve, reject) => {
            client = mqtt.connect(hostUrl, {
                username: username,
                password: password,
                clientId: clientId,
            });

            client.on('connect', function onConnAck(connAck) {
                resolve();
            });

            client.on('error', function onConnError(error) {
                reject(error);
            });
        });
    }
    
    async function send(topic, message, qos = 0) {
        return new Promise((resolve, reject) => {
            if (!client) {
                reject("Client has not connected yet");
            }

            client.publish(
                topic,
                message,
                { qos },
                function onPubAck(err) {
                    if (err) reject(err)
                    resolve();
                }
            );
        });
    }

    return produce({}, draft => {
        draft.connect = connect;
        draft.send = send;
    });
}

export default MqttClient;
