process.chdir(__dirname);

require('dotenv').config();
const tjs = require('teslajs');
const rp = require('request-promise');
const sleep = require('await-sleep');
const nodeGeocoder = require('node-geocoder');

var options = {
    provider: 'google',
    httpAdapter: 'https',
    apiKey: process.env.GOOGLE_MAP_API_KEY,
    formatter: null
};
var geocoder = nodeGeocoder(options);
let token = null;

const reverseCoords = async (lat, lon) => {
    return new Promise((resolve, reject) => {
        geocoder.reverse({lat: lat, lon: lon}, function(err, res) {
            if (err) {
                return reject(err);
            }
            const place = res[0];
            resolve(place.streetNumber + ' ' + place.streetName + ', ' + place.city);
        });
    });
};

if (process.argv.length === 3) {
    token = process.argv[2];
}

(async () => {
    try {
        if (!token) {
            console.log('Login as', process.env.USERNAME);
            let result = await tjs.loginAsync(process.env.USERNAME, process.env.PASSWORD);

            token = result.authToken;
            console.log('Logged in successfully');
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
        const vehicleName = data.display_name;

        let place = await reverseCoords(data.drive_state.latitude, data.drive_state.longitude);

        let content = [
            '🌍 Located @ ' + place,
            '🔋 Battery @ ' + data.charge_state.battery_level + '%',
            '🔌 Charge port ' + data.charge_state.charge_port_latch
        ];
        console.log(content.join("\n"));

        let hooks = JSON.parse(process.env.IFTT_HOOKS);
        for (let hook of hooks) {
            let response = await rp({
                uri: hook,
                method: 'POST',
                json: true,
                body: {
                    value1: '🚗 ' + vehicleName,
                    value2: content.join("\n"),
                    value3: 'https://media.glassdoor.com/sql/43129/tesla-squarelogo-1512420729170.png'
                }
            });
            console.log(response);
        }
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
