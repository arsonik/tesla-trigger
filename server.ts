import express, {Request, Response} from "express";
import bodyParser from "body-parser";
import teslajs, {setLogLevel} from 'teslajs';
import 'dotenv/config';

const MODEL_3 = 624944565;
const MODEL_X = 1805207515;

setLogLevel(0);

type VehicleID = number | string;

interface Token {
    "access_token": string,
    "token_type": string,
    "expires_in": number,
    "refresh_token": string,
    "created_at": number
}

interface Vehicle {
    "id": VehicleID,
    "vehicle_id": VehicleID,
    "vin": string,
    "display_name": string,
    "option_codes": string,
    "access_type": string,
    "tokens": string[],
    "state": string,
    "in_service": false,
    "id_s": VehicleID,
    "calendar_enabled": true,
    "api_version": number,
    "vehicle_config": any
}

interface Climate {
    battery_heater: boolean,
    battery_heater_no_power: any,
    climate_keeper_mode: string,
    defrost_mode: number,
    driver_temp_setting: number,
    fan_status: number,
    inside_temp: number,
    is_auto_conditioning_on: boolean,
    is_climate_on: boolean,
    is_front_defroster_on: boolean,
    is_preconditioning: boolean,
    is_rear_defroster_on: boolean,
    left_temp_direction: number,
    max_avail_temp: number,
    min_avail_temp: number,
    outside_temp: number,
    passenger_temp_setting: number,
    remote_heater_control_enabled: boolean,
    right_temp_direction: number,
    seat_heater_left: number,
    seat_heater_right: number,
    side_mirror_heaters: boolean,
    timestamp: number,
    wiper_blade_heater: boolean
}

class Tesla {
    private token?: Token;
    private readonly login: string;
    private readonly pass: string;
    private wakeupInterval = 10 * 1000;

    constructor(login: string, pass: string) {
        this.login = login;
        this.pass = pass;
    }

    private async teslaToken(): Promise<Token> {
        if (!this.token || Date.now() / 1000 > this.token.created_at + this.token.expires_in) {
            console.log(`🔑 Getting a new token`);
            const resp = await teslajs.loginAsync(this.login, this.pass);
            this.token = resp.body as any
        }
        if (!this.token) {
            throw new Error('No token');
        }
        return this.token
    }

    async vehicles(): Promise<Vehicle[]> {
        console.log(`🚘 Getting vehicles`);
        return teslajs.vehiclesAsync(await this.tjsParam()) as any;
    }

    async vehicle(vehicleID: VehicleID): Promise<Vehicle> {
        console.log(`🚘 Getting vehicle ${vehicleID}`);
        return await teslajs.vehicleAsync(await this.tjsParam(vehicleID)) as any;
    }

    async onlineVehicle(vehicleID: VehicleID): Promise<Vehicle> {
        let vehicle = await this.vehicle(vehicleID);

        let attempt = 0;
        while (vehicle.state !== 'online' && attempt < 10) {
            attempt++;
            console.log(`😴 Waking up`, vehicleID);
            vehicle = await teslajs.wakeUpAsync(await this.tjsParam(vehicle.id_s)).catch(() => ({state: 'error'})) as any;
            if (vehicle.state !== 'online') {
                console.log('💤 Sleep before retry');
                await sleep(this.wakeupInterval);
            }
        }
        if (vehicle.state != 'online') {
            throw new Error(`🥶 Cannot wake up vehicle ${vehicleID}`)
        }
        return vehicle;
    }

    async climate(vehicleID: VehicleID): Promise<Climate> {
        const vehicle = await this.onlineVehicle(vehicleID);
        return await teslajs.climateStateAsync(await this.tjsParam(vehicle.id_s)) as any
    }

    private async tjsParam(vehicleID?: VehicleID): Promise<{ authToken: string; vehicleID: string }> {
        return {authToken: (await this.teslaToken()).access_token, vehicleID: vehicleID?.toString() ?? ''}
    }

    async setTemperature(vehicleID: VehicleID, temp = 20) {
        const vehicle = await this.onlineVehicle(vehicleID);
        const res = await teslajs.setTempsAsync(await this.tjsParam(vehicle.id_s), temp, temp)
        if (!res.result) {
            throw new Error('cannot set temperature');
        }
        console.log(`🥵 Setting temperature on ${vehicleID} to ${temp}c`);
        const res2 = await teslajs.climateStartAsync(await this.tjsParam(vehicle.id_s))
        if (!res2.result) {
            throw new Error('cannot start hvac');
        }
        return true;
    }
    async hvacOff(vehicleID: VehicleID) {
        const vehicle = await this.onlineVehicle(vehicleID);
        console.log(`🍁 Stopping hvac on ${vehicleID}`);
        const res2 = await teslajs.climateStopAsync(await this.tjsParam(vehicle.id_s))
        if (!res2.result) {
            throw new Error('cannot start hvac');
        }
        return true;
    }
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function veh(id: string): VehicleID {
    switch (id) {
        case 'm3':
            return MODEL_3;
        case 'mx':
            return MODEL_X;
        default:
            throw new Error('Not found');

    }
}

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: false}));

const tesla = new Tesla(process.env.USERNAME ?? '', process.env.PASSWORD ?? '');

app.route("/").get(async (req: Request, res: Response) => {
    res.send('🤪');
});
app.route("/cars").get(async (req: Request, res: Response) => {
    const json = await tesla.vehicles();
    res.json(json.map((vehicule) => vehicule.display_name));
});
app.route("/car/:id/climate").get(async (req: Request, res: Response) => {
    const json = await tesla.climate(veh(req.params['id']));
    res.json(json);
});
app.route("/car/:id/warmup").get(async (req: Request, res: Response) => {
    const json = await tesla.setTemperature(veh(req.params['id']));
    res.send(json ? '🚘 Your car is warming up!' : 'Error');
});
app.route("/car/:id/hvacOff").get(async (req: Request, res: Response) => {
    const json = await tesla.hvacOff(veh(req.params['id']));
    res.send(json ? '🚘 Your car stopped hvac!' : 'Error');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
