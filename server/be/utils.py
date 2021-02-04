import timeit
from datetime import timedelta

import numpy as np

PRINT_TIMINGS = True


def set_printing(value):
    global PRINT_TIMINGS
    PRINT_TIMINGS = value


class CodeTimer:
    def __init__(self, name=None, do_print=None):
        self.do_print = do_print
        self.name = " '" + name + "'" if name else ''

    def __enter__(self):
        self.start = timeit.default_timer()

    def __exit__(self, exc_type, exc_value, traceback):
        self.took = (timeit.default_timer() - self.start) * 1000.0
        if self.do_print or PRINT_TIMINGS:
            print('Code block' + self.name + ' took: ' + str(timedelta(milliseconds=self.took)) + ' s')


def get_duplicates(my_list: list) -> list:
    items = np.array(my_list)
    s = np.sort(items)
    duplicates = s[:-1][s[1:] == s[:-1]]
    return duplicates.tolist()
