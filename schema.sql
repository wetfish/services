CREATE TABLE IF NOT EXISTS `accounts` (
  `account_id` int(11) NOT NULL AUTO_INCREMENT,
  `fish_id` varchar(64) NOT NULL,
  `host` varchar(64),
  `names` tinyint(1) NOT NULL,
  PRIMARY KEY (`account_id`),
  UNIQUE KEY `fish_id` (`fish_id`),
  UNIQUE KEY `host` (`host`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `names` (
  `account_id` int(11) NOT NULL,
  `name` varchar(64) NOT NULL,
  `registered` datetime NOT NULL,
  `active` datetime NOT NULL,
  PRIMARY KEY (`account_id`,`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `channels` (
  `channel_id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(64) NOT NULL,
  `owner` int(11) NOT NULL,
  `modes` varchar(32) NOT NULL,
  `registered` datetime NOT NULL,
  PRIMARY KEY (`channel_id`),
  UNIQUE KEY `name` (`name`),
  KEY `owner` (`owner`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;

CREATE TABLE IF NOT EXISTS `access` (
  `channel_id` int(11) NOT NULL,
  `name` varchar(64) NOT NULL,
  `admin` tinyint(1) NOT NULL,
  `modes` varchar(32) NOT NULL,
  PRIMARY KEY (`channel_id`,`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
