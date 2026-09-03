// sample3.ts — API response formatter
// Transforms raw API responses into standardised shape
// for consumption by the frontend layer


interface   RawApiResponse   {
    status_code   :   number;
    data          :   Record<string,   unknown>;
    error_message :   string   |   null;
    request_id    :   string;
}


interface   FormattedResponse<T>   {
    ok        :   boolean;
    payload   :   T   |   null;
    error     :   string   |   null;
    requestId :   string;
}


/**
 * Formats a raw API response into the standard shape.
 * Returns a typed FormattedResponse object.
 *
 * @param raw     The raw response from the API layer
 * @returns       A FormattedResponse with typed payload
 */
export   function   formatApiResponse<T>(
    raw   :   RawApiResponse
)   :   FormattedResponse<T>   {

    // Determine if the request was successful
    const   isOk   =   raw.status_code   >=   200   &&   raw.status_code   <   300;

    // Cast data to generic type T if successful, else null
    const   payload   :   T   |   null   =   isOk   ?   (   raw.data   as   T   )   :   null;

    return   {
        ok        :   isOk,
        payload   :   payload,
        error     :   raw.error_message   ??   null,
        requestId :   raw.request_id,
    };

}


/**
 * Type guard — checks if a FormattedResponse is successful.
 */
export   function   isSuccess<T>(
    response   :   FormattedResponse<T>
)   :   response   is   FormattedResponse<T>   &   {   ok:   true;   payload:   T   }   {

    return   response.ok   ===   true   &&   response.payload   !==   null;

}
