#!/bin/bash
sqlite3 data.db "Delete from layouts where ROWID = (SELECT MAX(ROWID) from layouts);";
