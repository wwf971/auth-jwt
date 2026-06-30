"""Config-level database endpoint management."""

from __future__ import annotations


def get_database_list(config) -> list:
    return config.get('DATABASE_LIST', [])


def get_current_database_id(config) -> int:
    return config.get('CURRENT_DATABASE_ID', 0)


def add_database(config, name: str, db_type: str, **kwargs) -> dict:
    database_list = config.get('DATABASE_LIST', [])

    max_id = max([db.get('id', 0) for db in database_list], default=0)
    new_id = max_id + 1

    new_db = {
        "id": new_id,
        "name": name,
        "type": db_type.lower(),
        "is_default": False,
        "is_removable": True
    }

    if db_type.lower() == 'sqlite':
        new_db.update({
            "path": kwargs.get('path', f'/data/auth_{new_id}.db'),
            "host": None,
            "port": None,
            "database": None,
            "username": None,
            "password": None
        })
    else:
        new_db.update({
            "path": None,
            "host": kwargs.get('host'),
            "port": kwargs.get('port'),
            "database": kwargs.get('database'),
            "username": kwargs.get('username'),
            "password": kwargs.get('password')
        })

    database_list.append(new_db)
    config['DATABASE_LIST'] = database_list

    return {
        "success": True,
        "message": f"Database '{name}' added successfully",
        "database": new_db
    }


def remove_database(config, db_id: int) -> dict:
    database_list = config.get('DATABASE_LIST', [])

    db_to_remove = None
    for db in database_list:
        if db.get('id') == db_id:
            db_to_remove = db
            break

    if not db_to_remove:
        return {
            "success": False,
            "message": f"Database with ID {db_id} not found"
        }

    if not db_to_remove.get('is_removable', True):
        return {
            "success": False,
            "message": "Cannot remove the default local database"
        }

    if config.get('CURRENT_DATABASE_ID') == db_id:
        return {
            "success": False,
            "message": "Cannot remove the currently active database. Switch to another database first."
        }

    database_list = [db for db in database_list if db.get('id') != db_id]
    config['DATABASE_LIST'] = database_list

    return {
        "success": True,
        "message": f"Database removed successfully"
    }


def update_database(config, db_id: int, **kwargs) -> dict:
    database_list = config.get('DATABASE_LIST', [])

    db_to_update = None
    db_index = None
    for i, db in enumerate(database_list):
        if db.get('id') == db_id:
            db_to_update = db
            db_index = i
            break

    if not db_to_update:
        return {
            "success": False,
            "message": f"Database with ID {db_id} not found",
            "database": None
        }

    allowed_fields = ['name', 'host', 'port', 'database', 'username', 'password', 'path']
    for field in allowed_fields:
        if field in kwargs:
            db_to_update[field] = kwargs[field]

    database_list[db_index] = db_to_update
    config['DATABASE_LIST'] = database_list

    return {
        "success": True,
        "message": "Database updated successfully",
        "database": db_to_update
    }


def change_current_database(config, db_id: int) -> dict:
    database_list = config.get('DATABASE_LIST', [])

    db_exists = any(db.get('id') == db_id for db in database_list)

    if not db_exists:
        return {
            "success": False,
            "message": f"Database with ID {db_id} not found"
        }

    config['CURRENT_DATABASE_ID'] = db_id

    return {
        "success": True,
        "message": f"Switched to database ID {db_id}. Database connection will be restarted."
    }
