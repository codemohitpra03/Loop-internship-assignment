export const query = `
DO $$
DECLARE
    
    uptime INT := 0;
    downtime INT := 0;
    prevStoreId BIGINT := NULL;
    prevStatus VARCHAR(10);
    prev_timestamp_utc TIMESTAMP:=DATE('2023-01-26');
    row record;
    yesterday_date_utc TIMESTAMP:= DATE('2023-01-26') - interval '1 day';--Hardcoded yesterday
    current_date_utc TIMESTAMP := DATE('2023-01-26') - interval '1 day';
 
BEGIN
    CREATE TEMPORARY TABLE master_table AS
        SELECT
	        result.store_id,
	        result.date,
            result.day_code,
            result.start_time_local,
            result.end_time_local,
            result.timezone_str,
            result.timestamp_utc,
            result.start_time_utc,
            result.end_time_utc,
            result.status
	    FROM (
	        SELECT
		        ss.store_id,
		        DATE(ss.timestamp_utc) AS date,
		        EXTRACT(DOW FROM ss.timestamp_utc) AS day_code,
		        ss.timestamp_utc,
		        sh.start_time_local,
		        sh.end_time_local,
		        COALESCE(stz.timezone_str, 'America/Chicago') AS timezone_str,
		        (sh.start_time_local::time AT TIME ZONE COALESCE(stz.timezone_str, 'America/Chicago'))::time AS start_time_utc,
		        (sh.end_time_local::time AT TIME ZONE COALESCE(stz.timezone_str, 'America/Chicago'))::time AS end_time_utc,
		        ss.status,
		        ROW_NUMBER() OVER (PARTITION BY ss.store_id ORDER BY DATE(ss.timestamp_utc) DESC, ss.timestamp_utc DESC) AS rn
	        FROM
		    store_status ss
	    JOIN
		    menu_hours sh ON ss.store_id = sh.store_id AND EXTRACT(DOW FROM ss.timestamp_utc) = sh.day_code
	    LEFT JOIN
		    store_timezone stz ON ss.store_id = stz.store_id
	) AS result
	WHERE
	    (result.timestamp_utc::time BETWEEN result.start_time_utc AND result.end_time_utc
	    AND result.date >= DATE('2023-01-26') - INTERVAL '7 days' )
    ORDER BY store_id, date DESC, timestamp_utc DESC;


    




    CREATE TEMPORARY TABLE max_row_nums (
        store_id bigint,
        max_row_num int,
        CONSTRAINT unique_cols_constraint UNIQUE (store_id)
    );




   
    CREATE TABLE result (
        store_id BIGINT PRIMARY KEY,
        up_time_last_hour_in_minutes INT,
        up_time_last_day_in_hours INT,
        up_time_last_week_in_hours INT,
        down_time_last_hour_in_minutes INT,
        down_time_last_day_in_hours INT,
        down_time_last_week_in_hours INT
    );

    

    FOR i IN 1..7 LOOP 
        DELETE FROM max_row_nums;
        INSERT INTO max_row_nums
        SELECT store_id,MAX(t2.row_num)
        FROM (
            SELECT *,ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY date DESC, timestamp_utc DESC) AS row_num
            FROM master_table WHERE timestamp_utc >=	current_date_utc and timestamp_utc<=prev_timestamp_utc
        ) as t2
        GROUP BY store_id
        ORDER BY store_id
        ON CONFLICT DO NOTHING;

        FOR row IN (
            SELECT
                *,
                ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY date DESC, timestamp_utc DESC) AS rn
            FROM 
	        master_table
            WHERE timestamp_utc >= current_date_utc and timestamp_utc<=prev_timestamp_utc
            )
  
        LOOP

		    IF row.rn = 1 OR row.store_id != prevStoreId THEN
		    
		        uptime := 0;
		        downtime := 0;
		        prevStatus := NULL;
		        prev_timestamp_utc := NULL;
		    END IF;
		    
            IF row.rn > 1 THEN
		        IF row.status = 'active' THEN
			        uptime := uptime + EXTRACT(HOUR FROM((prev_timestamp_utc::TIME) -(row.timestamp_utc::TIME)));
		        ELSIF row.status = 'inactive'THEN
		        	downtime := downtime + EXTRACT(HOUR FROM ((prev_timestamp_utc::TIME) -(row.timestamp_utc::TIME)));
		        END IF;
		    END IF;

   	        prevStoreId := row.store_id;
            prevStatus := row.status;
            prev_timestamp_utc := row.timestamp_utc;
    
            
	
  	        IF row.rn = (SELECT max_row_num FROM max_row_nums WHERE store_id = row.store_id) THEN
    
		
                RAISE NOTICE 'This is the last row for Group %:  on date: %       %   , %', row.store_id,row.date, uptime,downtime;
                INSERT INTO result (store_id, up_time_last_week_in_hours, down_time_last_week_in_hours)
                VALUES(row.store_id,uptime,downtime)
                ON CONFLICT (store_id)
                DO UPDATE SET
                    up_time_last_week_in_hours = EXCLUDED.up_time_last_week_in_hours+result.up_time_last_week_in_hours,
                    down_time_last_week_in_hours =EXCLUDED.down_time_last_week_in_hours+ result.down_time_last_week_in_hours
                WHERE EXCLUDED.store_id=row.store_id;
                
                IF row.date=DATE(yesterday_date_utc) THEN
                    UPDATE result
                    SET up_time_last_day_in_hours = uptime,
                        down_time_last_day_in_hours = downtime
                    WHERE store_id = row.store_id;
                END IF;
	        END IF;

	
	    END LOOP;
	    
        prev_timestamp_utc:=current_date_utc;
	    current_date_utc := current_date_utc - interval '1 day'; -- Move to the previous day
	    uptime:=0;
	    downtime:=0;
	END LOOP;


	UPDATE result 
	SET store_id=derived_data.store_id,
		up_time_last_hour_in_minutes=derived_data.uptime_in_minutes,
		down_time_last_hour_in_minutes=derived_data.downtime_in_minutes
	FROM (SELECT store_id, 
	CASE
		WHEN status = 'active' THEN 60 - EXTRACT(MINUTE FROM timestamp_utc)
		WHEN status = 'inactive' THEN EXTRACT(MINUTE FROM timestamp_utc)
	  END AS uptime_in_minutes,
	  CASE
		WHEN status = 'active' THEN EXTRACT(MINUTE FROM timestamp_utc)
		WHEN status = 'inactive' THEN 60 - EXTRACT(MINUTE FROM timestamp_utc)
	  END AS downtime_in_minutes,
	timestamp_utc
    -- 	,status
	FROM (
	  SELECT
		store_id,
		timestamp_utc,
		status
	  FROM (SELECT *
	FROM (
	  SELECT *,
		ROW_NUMBER() OVER (PARTITION BY store_id ORDER BY date DESC, timestamp_utc DESC) AS rn
	  FROM master_table AS temp
	) AS result) as foo where rn=1
	) as derived
	)AS derived_data
	WHERE result.store_id=derived_data.store_id;
	RAISE NOTICE 'UP: % DOWN: %',uptime,downtime;

EXCEPTION
  WHEN duplicate_table THEN
    
    --     RAISE NOTICE 'Table already exists';
    

END $$;







`