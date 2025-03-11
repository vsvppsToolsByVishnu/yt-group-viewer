import sqlite3

# Path to your authenticator.db file
db_path = "data/data.db"

def read_authenticator_db(db_path):
    try:
        # Connect to the database
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()

        # Fetch all tables in the database
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()

        if not tables:
            print("No tables found in the database.")
            return

        # Iterate through each table and fetch its data
        for table_name in tables:
            print(f"\nTable: {table_name[0]}")
            cursor.execute(f"SELECT * FROM {table_name[0]};")
            rows = cursor.fetchall()

            # Fetch column names
            cursor.execute(f"PRAGMA table_info({table_name[0]});")
            columns = [col[1] for col in cursor.fetchall()]

            # Print column names and rows
            print("Columns:", columns)
            print("Rows:")
            for row in rows:
                print(row)

        # Close the connection
        conn.close()

    except sqlite3.Error as e:
        print(f"Error reading database: {e}")

# Call the function
read_authenticator_db(db_path)
