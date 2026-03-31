#!/bin/bash
# Fix: Add isLang:true to Dil item in SETTING_PAGES
FP="../MobilePreview.html"
OLD="{label:'Dil',val:'T\u00fcrk\u00e7e'}"
NEW="{label:'Dil',val:'T\u00fcrk\u00e7e',isLang:true}"
sed -i "s/{label:'Dil',val:'Türkçe'}/{label:'Dil',val:'Türkçe',isLang:true}/g" "$FP"
echo "Done"
