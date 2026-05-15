Explore the project and create a new job type call ShellMulti that defines a new field in the add/edit job. This new filed will be a json config with this format
{  
    "LOOP": [  
        "--channels=123,5423,6534,765"  
        "--notify-to=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv",  
        "--notify-validations=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv"  
    ],  
    "RASTER": [  
        "--channels=43,356,7654,864"  
        "--notify-to=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv",  
        "--notify-validations=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv"  
    ]  
}  
And for each key of the json will append the defined json parameters to the task defined in the array and launch a different job for each key (most probably appending the key to the audit/run log.
Make sure that for example for each json entry and an example command
["bin/console md:process", "type=linear"]
you must append and run the following commands:
For "LOOP" key
`["bin/console md:process", "type=linear", "--channels=123,5423,6534,765", "--notify-to=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv", "--notify-validations=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv"]`
For "RASTER" key
`["bin/console md:process", "type=linear", "--channels=43,356,7654,864", "--notify-to=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv", "--notify-validations=desarrollo+mp-autosave@mediadata.tv,redaccion+mp-autosave@mediadata.tv"]`
Remember:
You must modify js template to permit addin/editing this new job type. Finally add the possibility to read the output of the launched task, it is actually logging to system log piping in the called command try anyway to read the output and let the UI show this output (not only return code)
No md, nor any other intermediate artifact to generate!