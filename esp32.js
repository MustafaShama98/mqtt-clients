// esp32-simulator.js
const mqtt = require('mqtt');

class ESP32Simulator {
    constructor() {
        this.client = mqtt.connect('mqtt://j81f31b4.ala.eu-central-1.emqxsl.com',
            {
                username: "art",
                password: "art123",
                clientId: "esp32",
                port: 8883,
                protocol: 'mqtts',
            });
        this.sys_id = null;
        this.setupMQTTHandlers();
        this.setupCommandInterface();
    }

    setupMQTTHandlers() {
        this.client.on('connect', () => {
            console.log('\nESP32 Simulator connected to MQTT broker');
            this.client.subscribe('install', { qos: 2 });
            console.log('Subscribed to /install topic');
            this.promptSensor();
        });

        this.client.on('message', async (topic, message) => {
            console.log(`\nReceived message on topic: ${topic}: \n ${message}`);
            try {
                const payload = JSON.parse(message.toString());

                if (topic === 'install') {
                    await this.handleInstallation(payload);
                }
                if( topic.includes('delete')){
                    await this.handle_deletion()
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        });

        this.client.on('error', (error) => {
            console.error('\nMQTT Error:', error);
        });

        this.client.on('reconnect', () => {
            console.log('\nReconnecting to MQTT broker...');
        });
    }

    promptSensor() {
        if (!this.sys_id) {
            process.stdout.write('\nESP32> Not installed yet. Please wait for installation.\n');
            return;
        }

        process.stdout.write('\nEnter sensor reading (or commands: status, reset, help, exit): ');
    }

    setupCommandInterface() {
        console.log('\nAvailable commands:');
        console.log('status  - Show current simulator status');
        console.log('reset   - Reset simulator (clear sys_id)');
        console.log('help    - Show this help message');
        console.log('exit    - Exit simulator\n');

        process.stdin.setEncoding('utf8');
        process.stdin.on('data', async (data) => {
            const input = data.toString().trim();

            switch (input.toLowerCase()) {
                case 'status':
                    this.showStatus();
                    break;
                case 'reset':
                    this.reset();
                    break;
                case 'help':
                    this.showHelp();
                    break;
                case 'sensor':
                    await this.publish_sensor(this.sys_id, {
                        value: '50',
                        timestamp: new Date().toISOString(),
                        device: 'esp32'
                    });
                  this.showHelp();
                 break;
                case 'exit':
                    this.exit();
                    break;
                // default:
                //     if (this.sys_id) {
                //         try {
                //             const sensorValue = parseFloat(input);
                //             if (isNaN(sensorValue)) {
                //                 console.log('Please enter a valid number or command');
                //             } else {
                //                 await this.publish_sensor(this.sys_id, {
                //                     value: sensorValue,
                //                     timestamp: new Date().toISOString(),
                //                     device: 'esp32'
                //                 });
                //             }
                //         } catch (error) {
                //             console.error('Error publishing sensor data:', error);
                //         }
                //     } else {
                //         console.log('Unknown command. Type "help" for available commands.');
                //     }
            }
            
            this.promptSensor();
        });
    }

    showStatus() {
        console.log('Current Status:');
        console.log('-------------');
        console.log(`Connection: ${this.client.connected ? 'Connected' : 'Disconnected'}`);
        console.log(`System ID: ${this.sys_id || 'Not assigned'}`);
        console.log('-------------');
    }

    showHelp() {
        console.log('Available Commands:');
        console.log('-------------');
        console.log('status  - Show current simulator status');
        console.log('reset   - Reset simulator (clear sys_id)');
        console.log('help    - Show this help message');
        console.log('exit    - Exit simulator');
        console.log('Enter number - Publish sensor reading');
        console.log('-------------');
    }

    reset() {
        const oldSysId = this.sys_id;
        this.sys_id = null;
        console.log(`Simulator reset. Previous sys_id ${oldSysId} cleared.`);
    }

    exit() {
        console.log('Shutting down simulator...');
        this.client.end();
        process.exit(0);
    }

    async handleInstallation(data) {
        console.log('Received installation request:', data);

        if (!data.sys_id) {
            console.log('Invalid installation request: no sys_id');
            return;
        }

        if (this.sys_id) {
            console.log(`Already installed with sys_id: ${this.sys_id}`);
            return;
        }

        this.sys_id = data.sys_id;
        console.log(`Taking new sys_id: ${this.sys_id}`);

        this.client.unsubscribe('install', (err) => {
            if (err) {
                console.error('Error unsubscribing from /install:', err);
            } else {
                console.log('Successfully unsubscribed from /install topic');
            }
        });

        const specificTopic = `m5stack/${this.sys_id}/sensor`;
        await new Promise(resolve => this.client.subscribe(specificTopic,{ qos: 2 }, resolve));
        console.log(`Subscribed to: ${specificTopic}`);

        await new Promise(resolve => setTimeout(resolve, 500));
        await this.publishResponse(this.sys_id, {
            success: true,
            message: `Successfully installed with sys_id: ${this.sys_id}`,
            sys_id: this.sys_id,
            device: 'esp32'
        });

        await new Promise(resolve => this.client
            .subscribe(`m5stack/${this.sys_id}/delete`
            , resolve));
        console.log(`Subscribed to: delete topic`);

        this.promptSensor();
    }

    async publish_sensor(sys_id, response) {
        const topic = `m5stack/${sys_id}/sensor`;
        console.log(`Publishing sensor data to ${topic}:`, response);

        return new Promise((resolve) => {
            this.client.publish(topic, JSON.stringify(response), { qos: 2 }, () => {
                console.log('Sensor data published successfully');
                resolve();
            });
        });
    }

    async publishResponse(sys_id, response) {
        const topic = `m5stack/${sys_id}/install`;
        console.log(`Publishing response to ${topic}:`, response);

        return new Promise((resolve) => {
            this.client.publish(topic, JSON.stringify(response), { qos: 2 }, () => {
                console.log('Response published successfully');
                resolve();
            });
        });    

     
        
    }
async handle_deletion(){
         this.sys_id=null;
         console.log('Deleted sys_id')
    }
    
}

// Create and start simulator
const simulator = new ESP32Simulator();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down gracefully...');
    simulator.client.end();
    process.exit();
});