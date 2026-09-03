# sample2.py — User data processing service
# Handles reading, filtering and transforming user records
# from a list of dictionaries


from   typing   import   List,   Dict,   Optional


class   UserProcessor:
    """
    A class that processes user data records.
    Provides filtering and transformation utilities.
    """


    def   __init__(   self,   users:   List[Dict]   ):
        """
        Initialise the processor with a list of user dicts.
        """

        # Store the user list internally
        self.users   =   users


    def   get_active_users(   self   )   ->   List[Dict]:
        """
        Returns only users where the 'active' field is True.
        """

        # Filter using a list comprehension
        return   [   u   for   u   in   self.users   if   u.get(   'active',   False   )   ]


    def   get_user_by_id(   self,   user_id:   int   )   ->   Optional[Dict]:
        """
        Returns the user dict matching the given ID, or None.
        """

        # Iterate and match
        for   user   in   self.users:
            if   user.get(   'id'   )   ==   user_id:
                return   user

        # No match found
        return   None


    def   summarise(   self   )   ->   Dict:
        """
        Returns a summary dict with total and active counts.
        """

        total   =   len(   self.users   )
        active   =   len(   self.get_active_users()   )

        return   {
            'total'   :   total,
            'active'  :   active,
            'inactive':   total   -   active,
        }
