import sqlite3
from sqlite3 import Cursor

from flask import json

init_sql = """
CREATE TABLE IF NOT EXISTS layouts (
 content TEXT NOT NULL
);"""

insert_layout_sql = """
INSERT INTO layouts (content) VALUES (?)"""

get_layout_by_id_sql = """
SELECT ROWID,content 
FROM layouts WHERE rowid == (?)"""

get_all_layouts_sql = """
SELECT content 
FROM layouts
ORDER BY ROWID DESC 
LIMIT (?) OFFSET (?)"""

# This is as dirty as the whole database schema. It was introduced to omit the need for introducing an additional column
get_all_unfinished_layouts_sql = """
SELECT content 
FROM layouts
WHERE layouts.content LIKE '%IN_PROGRESS%'
ORDER BY ROWID ASC """

update_layout_by_id_sql = """
UPDATE layouts
SET content = (?) WHERE ROWID == (?)"""


class DataStore(object):
    """
    This class abstracts the underlying data store from the application. It provides methods create, read and update
    data.
    """

    def __init__(self, data_path):
        """
        Connects to a datastore at data_path. If there exists none a new one will be created and initialised.

        :param data_path: the path to use for the data store
        """
        self._should_shutdown = False
        self.data_path = data_path
        with self._get_connection() as conn:
            c = conn.cursor()
            c.execute(init_sql)
            conn.commit()
            c.close()

    def insert_new_element(self, element):
        """
        Inserts a new elements into the data store and return the inserted element including the generated id.

        :param element: the element to store
        :return: the stored element
        """
        json_str = json.dumps(element)
        with self._get_connection() as conn:
            c = conn.cursor()
            c.execute(insert_layout_sql, (json_str,))
            last_id = c.lastrowid
            element['id'] = last_id
            conn.commit()
        self.update_entry(last_id, element)
        return element

    def _get_connection(self):
        if self._should_shutdown:
            raise Exception("The application is about to shut down. No new connections will be opened.")
        return sqlite3.connect(self.data_path)

    def get_all(self, limit=20, offset=0):
        """
        This method obtains multiple stored elements. Also provides parameters to paginate the output.

        :param limit: the number of elements to return at max
        :param offset: the offset where to start
        :return: a list of elements
        """
        with self._get_connection() as conn:
            c: Cursor = conn.cursor()
            c.execute(get_all_layouts_sql, (limit, offset))
            results = c.fetchall()
            res = []
            for result in results:
                res.append(json.loads(result[0]))
        return res

    def get_by_id(self, elem_id):
        """
        Obtains an element by id.

        :param elem_id: the element id
        :return: the element or None if the id was not found.
        """
        with self._get_connection() as conn:
            c: Cursor = conn.cursor()
            c.execute(get_layout_by_id_sql, (elem_id,))
            result = c.fetchone()
        if result is None:
            return None
        element = json.loads(result[1])
        element['id'] = str(result[0])
        return element

    def update_entry(self, elem_id, element):
        """
        Updates the entry with the given id to contain the new contents.

        :param elem_id: the element id
        :param element: the new element content
        :return: the updated element
        """
        element['id'] = str(elem_id)
        json_str = json.dumps(element)
        with self._get_connection() as conn:
            c: Cursor = conn.cursor()
            c.execute(update_layout_by_id_sql, (json_str, elem_id))
            conn.commit()
        return element

    def get_unfinished_jobs(self):
        with self._get_connection() as conn:
            c: Cursor = conn.cursor()
            c.execute(get_all_unfinished_layouts_sql)
            results = c.fetchall()
        if results is None:
            return []
        res = []
        for result in results:
            res.append(json.loads(result[0]))
        return res

    def prepare_shutdown(self):
        self._should_shutdown = True
