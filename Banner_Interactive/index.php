<?php
// ini_set('display_errors', 1);
// ini_set('display_startup_errors', 1);
// error_reporting(E_ALL);
require("config.php");
$url = "http://". $ip ."/api/v1/b/" . $bot_ID . "/i" . "/" . $instance_ID . "/event/client_db_info";
$myObj->ip = getUserIP();
$req = curl_request($url, $myObj, "POST");
$client = $req[0];
// Load images from folder.
$dir = 'images/Background/*';
$images = glob($dir);
$random_key = array_rand($images);
$img = imagecreatefrompng($images[$random_key]);
imagealphablending($img, true);
imagesavealpha($img, true);
// If client is found on teamspeak 3 server.
if (!is_null($client)) {
    $max = $client["to_next_lvl"];
    $r = 255;
    $g = 255;
    $b = 255;
    $font = "fonts/SourceSansPro-Semibold.ttf";
    // Client has reached max lvl, prepare "Max" banner.
    if (is_null($max)) {
        $hud = imagecreatefrompng('images/HUD_Max.png');
        imagecopy($img, $hud, 0, 0, 0, 0, 1920, 1080);
        // text-color
        $text_color = imagecolorallocate($img, $r, $g, $b);

        $level = "Poziom: " . $client["lvl"];

        $hours = round($client["time"]/3600);
        if ($hours < 1) {
            $minutes = round($client["time"]/60);
            $time_spent = "Minut: " . $minutes;
        } else {
            $time_spent = "Godzin: " . $hours;
        }

        $rank = "Pozycja: " .  $client["rank"];

        $offset = 70;
        $size = 52;
        $x = 387;

        imagettftext($img, $size, 0, $x, 220+$offset, $text_color, $font, $level);
        imagettftext($img, $size, 0, $x, 497+$offset, $text_color, $font, $time_spent);
        imagettftext($img, $size, 0, $x, 766+$offset, $text_color, $font, $rank);
    } else {
        $hud = imagecreatefrompng('images/HUD_Basic.png');
        imagecopy($img, $hud, 0, 0, 0, 0, 1920, 1080);
        // text-color
        $text_color = imagecolorallocate($img, $r, $g, $b);

        $level = "Poziom: " . $client["lvl"];

        $hours = round($client["time"]/3600);
        if ($hours < 1) {
            $minutes = round($client["time"]/60);
            $time_spent = "Minut: " . $minutes;
        } else {
            $time_spent = "Godzin: " . $hours;
        }

        $to_next_lvl_hours = round($client["to_next_lvl"]/3600);
        if ($to_next_lvl_hours < 1) {
            $minutes = round($client["to_next_lvl"]/60);
            $to_next_lvl = "Do następnego poziomu: " . $minutes . "m";
        } else {
            $to_next_lvl = "Do następnego poziomu: " . $to_next_lvl_hours;
        }
        
        $rank = "Pozycja: " .  $client["rank"];

        $offset = 60;
        $size = 52;
        $x = 330;

        imagettftext($img, $size, 0, $x, 180+$offset, $text_color, $font, $level);
        imagettftext($img, $size, 0, $x, 401+$offset, $text_color, $font, $time_spent);
        imagettftext($img, $size, 0, $x, 624+$offset, $text_color, $font, $to_next_lvl);
        imagettftext($img, $size, 0, $x, 840+$offset, $text_color, $font, $rank);
    }
}

header('Content-type: image/png');
// Write the image bytes to the client
imagepng($img);
imagedestroy($img);

function curl_request($url, $params, $type) {
    $ch = curl_init();    
    $myJSON = json_encode($params);
    
    curl_setopt($ch, CURLOPT_URL, $url);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, 1);
    if ($type == "POST") {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $myJSON);
        curl_setopt($ch, CURLOPT_POST, 1);
    }
    
    $headers = array();
    $headers[] = 'Content-Type: application/json';
    curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
    
    $result = curl_exec($ch);
    if (curl_errno($ch)) {
        echo 'Error:' . curl_error($ch);
    }
    curl_close ($ch);
    
    $response = json_decode($result, true);
    return $response;
}

function getUserIP() {
    $ipaddress = '';
    if (isset($_SERVER['HTTP_CLIENT_IP']))
        $ipaddress = $_SERVER['HTTP_CLIENT_IP'];
    else if(isset($_SERVER['HTTP_X_FORWARDED_FOR']))
        $ipaddress = $_SERVER['HTTP_X_FORWARDED_FOR'];
    else if(isset($_SERVER['HTTP_X_FORWARDED']))
        $ipaddress = $_SERVER['HTTP_X_FORWARDED'];
    else if(isset($_SERVER['HTTP_X_CLUSTER_CLIENT_IP']))
        $ipaddress = $_SERVER['HTTP_X_CLUSTER_CLIENT_IP'];
    else if(isset($_SERVER['HTTP_FORWARDED_FOR']))
        $ipaddress = $_SERVER['HTTP_FORWARDED_FOR'];
    else if(isset($_SERVER['HTTP_FORWARDED']))
        $ipaddress = $_SERVER['HTTP_FORWARDED'];
    else if(isset($_SERVER['REMOTE_ADDR']))
        $ipaddress = $_SERVER['REMOTE_ADDR'];
    else
        $ipaddress = 'UNKNOWN';
    return $ipaddress;
}

// class Client_DB extends AnotherClass implements Interface
// {
    
// }