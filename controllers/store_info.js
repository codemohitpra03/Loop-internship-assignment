import db from '../db.js'
import {query} from './query.js'
let runningStatus = 'pending';
let report_id=''
let done=false;
const get_report_id=()=>{
    return 'pm'
}

export const trigger = async(req,res) =>{
    try {
        runningStatus = 'running';
        done=false;
        const result = await db.query(query);
        
        runningStatus = 'completed';
        report_id=get_report_id();
        done=true;
        res.status(200).json({status:'ok',report_id:report_id})
    } catch (error) {
        runningStatus = 'interrupted';
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const get_store_report = async(req,res) =>{
    
    
    if(!done){
        return res.status(200).json({status:runningStatus})
        
    }else{

        try {
            const result = await db.query('select * from result order by store_id;')
            done=true;
            console.log(result);
            return res.status(200).json({status:runningStatus,result:result.rows})
        } catch (error) {
           
            console.error('Error executing query:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    }

}