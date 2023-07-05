import express from "express"

import { get_store_report, trigger} from './controllers/store_info.js';

const app = express();



app.get('/api/trigger_report', trigger);
app.get('/api/get_report/:id', get_store_report);


const port = 3000;
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
