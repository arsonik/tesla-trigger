require('dotenv').config();
const tjs = require('teslajs');
const request = require('async-request');
const sleep = require('await-sleep');

let token = null;
if (process.argv.length === 3) {
    token = process.argv[2];
}

async function exec() {
    if (!token) {
        console.log('Login as', process.env.USERNAME);
        let result = await tjs.loginAsync(process.env.USERNAME, process.env.PASSWORD);

        token = result.authToken;
        console.log('Logged in with token', token);
    }

    console.log('Geting vehicle info', process.env.VEHICLE_ID);
    let vehicle = null;
    let attempt = 0;
    do {
        vehicle = await tjs.wakeUpAsync({authToken: token, vehicleID: process.env.VEHICLE_ID});
        if (vehicle.state === 'offline') {
            console.log('Vehicle is offline, waking up !');
            console.log('Sleeping');
            await sleep(15 * 1000);
        }
    } while (vehicle.state === 'offline' && attempt < 10);

    const data = await tjs.vehicleDataAsync({authToken: token, vehicleID: process.env.VEHICLE_ID});
    const location = [data.drive_state.latitude, data.drive_state.longitude];
    const vehicleName = data.display_name;

    let content = [
        '🌍 Located @ ' + location.join(', '),
        '🔋 Battery @ ' + data.charge_state.battery_level + '%',
    ];

    if (data.charge_state.charge_port_latch === 'Blocking') {
        content.push('🔌 Not plugged in: ' + data.charge_state.charge_port_latch);

    }
    const hook = process.env.IFTT + '?value1=' + encodeURI('🚗 ' + vehicleName) + '&value2=' + encodeURI(content.join("\n"));
    let response = await request(hook);
    console.log(response);
    process.exit(0);
}

try {
    exec();
} catch (e) {
    console.error(e);
    process.exit(1);
}
