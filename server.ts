import express from 'express';
import bodyParser from 'body-parser';
import { Tesla } from './src/tesla';

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

const tesla = new Tesla(process.env.USERNAME ?? '', process.env.PASSWORD ?? '');

app.route('/').get(async (req, res) => {
    res.send('🤪');
});
app.route('/cars').get(async (req, res) => {
    const json = await tesla.listVehicles();
    res.json(json.map((vehicule) => vehicule.display_name));
});
app.route('/car/:vin').get(async (req, res) => {
    try {
        const json = await tesla.data(req.params['vin']);
        res.json(json);
    } catch (e) {
        console.log(e);
        res.sendStatus(404);
    }
});
app.route('/car/:vin/climate').get(async (req, res) => {
    const json = await tesla.climate(req.params['vin']);
    res.json(json);
});
app.route('/car/:vin/warmup').get(async (req, res) => {
    const json = await tesla.setTemperature(req.params['vin']);
    res.send(json ? '🚘 Your car is warming up!' : 'Error');
    if (json.result) {
        res.send({ ...json, message: '🚘 Your car stopped hvac!' });
    } else {
        res.sendStatus(500);
    }
});
app.route('/car/:vin/hvacOff').get(async (req, res) => {
    const json = await tesla.hvacOff(req.params['vin']);
    if (json.result) {
        res.send({ ...json, message: '🚘 Your car stopped hvac!' });
    } else {
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Listening on port ${PORT}`));
