import json
from db.connection import get_connection

def insert_champion(data):
    conn = get_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO champions (data) VALUES (%s)", [json.dumps(data)])
    conn.commit()
    cur.close()
    conn.close()
