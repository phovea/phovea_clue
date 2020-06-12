/* *****************************************************************************
 * Caleydo - Visualization for Molecular Biology - http://caleydo.org
 * Copyright (c) The Caleydo Team. All rights reserved.
 * Licensed under the new BSD license, available at http://caleydo.org/license
 **************************************************************************** */

//allow sass modules
declare module "*.scss" {
  const content:string;
  export default content;
}
declare module "*.css" {
  const content:string;
  export default content;
}
// allow image dependencies
declare module "*.png";
declare module "*.jpg";
declare module "*.gif";
declare module "*.webp";
declare module "*.svg";
//allow html dependencies
declare module "*.html" {
  const content:string;
  export default content;
}
declare module "*.xml" {
  const content:string;
  export default content;
}
