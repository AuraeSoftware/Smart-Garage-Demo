import pg8000.native

def create_database():
    try:
        con = pg8000.native.Connection(user='postgres', password='krsb', host='localhost', port=5432, database='postgres')
        con.run("COMMIT")  # Ensure we are not in a transaction block
        try:
            con.run("CREATE DATABASE washpro")
            print("Database 'washpro' created successfully.")
        except Exception as inner_e:
            print(f"Failed to execute CREATE DATABASE: {inner_e}")
    except Exception as e:
        print(f"Error connecting to postgres: {e}")
    finally:
        if 'con' in locals():
            con.close()

if __name__ == "__main__":
    create_database()
