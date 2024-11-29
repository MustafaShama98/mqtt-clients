// m5stack-simulator.js
const mqtt = require('mqtt');

class M5StackSimulator {
    constructor() {
        this.client =mqtt.connect('mqtt://j81f31b4.ala.eu-central-1.emqxsl.com',
            {username: "art",
            password: "art123",
            clientId: "m5stack",
            port: 8883,
            protocol: 'mqtts',});
        this.sys_id = null;
        this.setupMQTTHandlers();
    }

    setupMQTTHandlers() {
        this.client.on('connect', () => {
            console.log('\nM5Stack Simulator connected to MQTT broker');
            this.client.subscribe('install', { qos: 2 });
            console.log('Subscribed to /install topic');
            this.showPrompt();
        });

        this.client.on('message', async (topic, message) => {
            console.log(`\nReceived message on topic: ${topic}: \n ${message}` );
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
            this.showPrompt();
        });

        this.client.on('error', (error) => {
            console.error('\nMQTT Error:', error);
            this.showPrompt();
        });

        this.client.on('reconnect', () => {
            console.log('\nReconnecting to MQTT broker...');
        });
    

    }

    setupCommandInterface() {
        console.log('\nAvailable commands:');
        console.log('status  - Show current simulator status');
        console.log('reset   - Reset simulator (clear sys_id)');
        console.log('help    - Show this help message');
        console.log('exit    - Exit simulator\n');

        // Set up stdin to handle commands
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (data) => {
            this.handleCommand(data.trim());
        });
    }

    handleCommand(command) {
        console.log('\n');  // Add newline for better readability
        
        switch(command.toLowerCase()) {
            case 'status':
                this.showStatus();
                break;
            case 'reset':
                this.reset();
                break;
            case 'help':
                this.showHelp();
                break;
            case 'exit':
                this.exit();
                break;
            default:
                console.log('Unknown command. Type "help" for available commands.');
                break;
        }
        
        this.showPrompt();
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

    showPrompt() {
        process.stdout.write('\nm5stack> ');
    }

    async handleInstallation(data) {
        console.log('Received installation request:', data);

        // Don't process if no sys_id in request
        if (!data.sys_id) {
            console.log('Invalid installation request: no sys_id');
            return;
        }

        if (this.sys_id) {
            console.log(`Already installed with sys_id: ${this.sys_id}`);
            // await this.publishResponse(data.sys_id, {
            //     success: false,
            //     error: `Already installed with sys_id: ${this.sys_id}`
            // });
            return;
        }

        // Accept new installation
        this.sys_id = data.sys_id;
        console.log(`Taking new sys_id: ${this.sys_id}`);
            // Unsubscribe from install topic since we're now installed
    this.client.unsubscribe('install', (err) => {
        if (err) {
            console.error('Error unsubscribing from /install:', err);
        } else {
            console.log('Successfully unsubscribed from /install topic');
        }
    });
        // Subscribe to specific topic
        const specificTopic = `m5stack/${this.sys_id}/height`;
        await new Promise(resolve => this.client.subscribe(specificTopic, { qos: 2 }, resolve));
        console.log(`Subscribed to: ${specificTopic}`);
        
        // Send success response with delay to ensure subscription is complete
        await new Promise(resolve => setTimeout(resolve, 500));
        await this.publishResponse(this.sys_id, {
            success: true,
            message: `Successfully installed with sys_id: ${this.sys_id}`,
            sys_id: this.sys_id,
            device: 'm5stack'
        });

         await new Promise(resolve => this.client
            .subscribe(`m5stack/${this.sys_id}/delete`
            , resolve));
        console.log(`Subscribed to: delete topic`);
    }


    async handle_deletion(){
         this.sys_id=null;
         console.log('Deleted sys_id')
    }
    async publish_height(sys_id, response) {
        const topic = `m5stack/${sys_id}/height`;
        console.log(`Publishing response to ${topic}:`, response);
        
        return new Promise((resolve) => {
            this.client.publish(topic, JSON.stringify(response), { qos: 2 }, () => {
                console.log('Response install published successfully');
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
}

// Create and start simulator
const simulator = new M5StackSimulator();

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nReceived SIGINT. Shutting down gracefully...');
    simulator.client.end();
    process.exit();
});