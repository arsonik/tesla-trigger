import express, {Request, Response, Application} from "express";
import bodyParser from "body-parser";
import teslajs from 'teslajs';
import 'dotenv/config';

class App {
    public app: Application;
    public routePrv: Routes = new Routes();

    constructor() {
        this.app = express();
        this.config();
        this.routePrv.routes(this.app);
    }

    private config(): void {
        this.app.use(bodyParser.json());
        this.app.use(bodyParser.urlencoded({ extended: false }));
    }
}


export class NodesController {
    public index(req: Request, res: Response) {
        res.json({
            message: "Hello boi"
        });
    }
}

export class Routes {
    public nodesController: NodesController = new NodesController();

    public routes(app: Application): void {
        app.route("/").get(this.nodesController.index);
    }
}


const app = new App().app;

const PORT = process.env.PORT || 3000;

console.log('Login as', process.env.USERNAME);
app.listen(PORT, () => console.log(`Example app listening on port ${PORT}!`));
