import httpx
import xml.etree.ElementTree as ET
from bs4 import BeautifulSoup
import datetime

url = "https://news.google.com/rss/search?q=agriculture+farmer+india&hl=en-IN&gl=IN&ceid=IN:en"
headers = {"User-Agent": "Mozilla/5.0"}
resp = httpx.get(url, headers=headers)
root = ET.fromstring(resp.content)
items = root.findall(".//item")
for item in items[:5]:
    title = item.find("title").text
    link = item.find("link").text
    description = item.find("description").text
    print(f"Title: {title}\nLink: {link}\nDescription: {description}\n")
