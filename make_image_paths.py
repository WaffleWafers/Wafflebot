import glob, json

# Change value to directory containing jpg files.
image_directory = "/root/images/iu/"

jpg_files = glob.glob(image_directory + "*.jpg")

collection = {}
collection['paths'] = jpg_files
json_data = json.dumps(collection)

print(len(collection['paths']))

with open('iuimages.json', 'w') as outfile:
    json.dump(collection, outfile)
