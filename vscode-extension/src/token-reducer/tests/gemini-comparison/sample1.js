// sample1.js — Authentication utility
// This file handles user authentication logic
// including token validation and session management

const   JWT_SECRET   =   'super-secret-key-123';


/**
 * Validates a JWT token
 * @param {string} token - The JWT token to validate
 * @returns {boolean} - True if valid, false otherwise
 */
function   validateToken(   token   )   {

    if (   !token   )   {
        return   false;
    }

    try   {
        // Split the token into parts
        const   parts   =   token.split(   '.'   );

        // A valid JWT has exactly 3 parts
        if (   parts.length   !==   3   )   {
            return   false;
        }

        // Decode the payload
        const   payload   =   JSON.parse(   atob(   parts[1]   )   );

        // Check expiry
        if (   payload.exp   &&   payload.exp   <   Date.now() / 1000   )   {
            return   false;
        }

        return   true;

    }   catch   (err)   {
        // Token parsing failed
        console.error(   'Token validation error:'   ,   err   );
        return   false;
    }


}


/**
 * Generates a simple session ID
 * @returns {string} - A random session ID string
 */
function   generateSessionId()   {

    // Use Math.random for simplicity in this example
    return   Math.random().toString(36).substring(   2   ,   15   )   +
             Math.random().toString(36).substring(   2   ,   15   );

}


module.exports   =   {   validateToken   ,   generateSessionId   };
