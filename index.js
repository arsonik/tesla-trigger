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

const log = function () {
    console.log(arguments);
};

if (process.argv.length === 3) {
    token = process.argv[2];
}

let hooks = JSON.parse(process.env.IFTT_HOOKS);

(async () => {
    try {
        if (!token) {
            log('Login as', process.env.USERNAME);
            let result = await tjs.loginAsync(process.env.USERNAME, process.env.PASSWORD);
            if (!result.authToken) {
                throw new Error("No auth token");
            }

            token = result.authToken;
            log('Logged in successfully with token ' + token);
        }

        log('Getting all vehicles');

        const vehicles = await tjs.vehiclesAsync({authToken: token});

        for (let vehicle of vehicles) {
            let vehicleState = vehicle.state;
            let attempt = 0;
            while ((vehicleState === 'offline' || vehicleState === 'asleep') && attempt < 10) {
                attempt++;
                log('Waking up ' + vehicle.display_name);
                let avehicle = await tjs.wakeUpAsync({authToken: token, vehicleID: vehicle.id_s});
                vehicleState = avehicle.state;
                if (vehicleState === 'offline' || vehicleState === 'asleep') {
                    log('Sleep before retry');
                    await sleep(15 * 1000);
                }
            }

            log('Getting vehicle data ' + vehicle.display_name);
            let data = null;
            attempt = 0;
            while (!data && attempt < 10) {
                attempt++;
                try {
                    data = await tjs.vehicleDataAsync({authToken: token, vehicleID: vehicle.id_s});
                } catch (e) {
                    console.log('sleep 1s')
                    await sleep(1000);
                }
            }
            if (!data) {
                throw new Error("No data for vehicle");
            }

            let place = await reverseCoords(data.drive_state.latitude, data.drive_state.longitude);

            let content = [
                '🌍 ' + place,
                '🔌 ' + data.charge_state.charging_state
            ];

            for (let hook of hooks) {
                let response = await rp({
                    uri: hook,
                    method: 'POST',
                    json: true,
                    body: {
                        value1: vehicle.display_name + ' 🔋 ' + data.charge_state.battery_level + '%',
                        value2: content.join("\n"),
                        value3: 'https://media.glassdoor.com/sql/43129/tesla-squarelogo-1512420729170.png'
                    }
                });
                log(response);
            }
        }

        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
})();
