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
        const result = await db.query(query);
        
        runningStatus = 'completed';
        report_id=get_report_id();
        res.status(200).json({report_id})
    } catch (error) {
        runningStatus = 'interrupted';
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export const get_store_report = async(req,res) =>{
    
    if(req.params.id!==report_id){
        return res.status(500).json({error:"Wrong report id"})
    }
    if(!done){
        res.status(200).json({status:runningStatus})
    }
    try {
        const result = await db.query('select * from result order by store_id;')
        done=true;
        console.log(result);
        res.status(200).json({status:runningStatus,result:result.rows})
    } catch (error) {
       
        console.error('Error executing query:', error);
        res.status(500).json({ error: 'Internal server error' });
    }

}