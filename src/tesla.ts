/* eslint-disable */
import teslajs, {Result, setLogLevel} from 'teslajs';
import {Climate, VehicleData, Vehicle, Token} from "./types/tesla";

setLogLevel(0);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class Tesla {
    private token?: Token = {
        access_token: 'qts-41932f6738b3cafedc3875f25ec8f8c3bbd570a9dc9a506fc0f0dd475cc27354',
        token_type: 'bearer',
        expires_in: 3888000,
        refresh_token: 'af092015394b96f5955de441407db97e5e96f377f7360d8a23df8cad2dcb2cd9',
        created_at: 1601895127,
    };
    private readonly login: string;
    private readonly pass: string;
    private wakeupInterval = 10 * 1000;

    private vehicles?: Vehicle[];

    constructor(login: string, pass: string) {
        this.login = login;
        this.pass = pass;
    }

    private async teslaToken(): Promise<Token> {
        if (!this.token || Date.now() / 1000 > this.token.created_at + this.token.expires_in) {
            console.log('🔑 Getting a new token');
            const resp = await teslajs.loginAsync(this.login, this.pass);
            this.token = resp.body as any;
        }
        if (!this.token) {
            throw new Error('No token');
        }
        return this.token;
    }

    async listVehicles(): Promise<Vehicle[]> {
        if (!this.vehicles) {
            console.log('🚘 Getting vehicles');
            this.vehicles = (await teslajs.vehiclesAsync(await this.tjsParam())) as any;
        }
        return this.vehicles ?? [];
    }

    async modelWithVIN(vin: string, wakeUp = false): Promise<Vehicle> {
        await this.listVehicles();
        const model = this.vehicles?.find((ve) => ve.vin.indexOf(vin) > 0);
        if (!model) {
            throw new Error(`Cannot find vin ${vin}`);
        }
        if (wakeUp) {
            await this.onlineVehicle(model);
        }
        return model;
    }

    async vehicle(model: Vehicle): Promise<Vehicle> {
        console.log(`🚘 Getting vehicle ${model.display_name}`);
        return (await teslajs.vehicleAsync(await this.tjsParam(model))) as any;
    }

    private async tjsParam(model?: Vehicle): Promise<{ authToken: string; vehicleID: string }> {
        return {
            authToken: (await this.teslaToken()).access_token,
            vehicleID: (model?.id_s || '') ?? '',
        };
    }

    private async onlineVehicle(model: Vehicle): Promise<Vehicle> {
        let vehicle = await this.vehicle(model);

        let attempt = 0;
        while (vehicle.state !== 'online' && attempt < 10) {
            attempt++;
            console.log('😴 Waking up', model);
            vehicle = (await teslajs.wakeUpAsync(await this.tjsParam(model)).catch(() => ({ state: 'error' }))) as any;
            if (vehicle.state !== 'online') {
                console.log('💤 Sleep before retry');
                await sleep(this.wakeupInterval);
            }
        }
        if (vehicle.state != 'online') {
            throw new Error(`🥶 Cannot wake up vehicle ${model.display_name}`);
        }
        return vehicle;
    }

    async climate(vin: string): Promise<Climate> {
        const model = await this.modelWithVIN(vin, true);
        return (await teslajs.climateStateAsync(await this.tjsParam(model))) as any;
    }

    async data(vin: string): Promise<VehicleData> {
        const model = await this.modelWithVIN(vin, true);
        return (await teslajs.vehicleDataAsync(await this.tjsParam(model))) as any;
    }

    async setTemperature(vin: string, temp = 22) : Promise<Result> {
        const model = await this.modelWithVIN(vin, true);
        const res = await teslajs.setTempsAsync(await this.tjsParam(model), temp, temp);
        if (!res.result) {
            throw new Error('cannot set temperature');
        }
        console.log(`🥵 Setting temperature on ${model.display_name} to ${temp}c`);
        return  await teslajs.climateStartAsync(await this.tjsParam(model));
    }

    async hvacOff(vin: string): Promise<Result> {
        const model = await this.modelWithVIN(vin, true);
        console.log(`🍁 Stopping hvac on ${model.display_name}`);
        return await teslajs.climateStopAsync(await this.tjsParam(model));
    }
}
