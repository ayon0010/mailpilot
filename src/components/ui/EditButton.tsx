"use client";

import React from "react";
import { Button } from "./button";
import { RiEditLine } from "@remixicon/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import Link from "next/link";

const EditButton = ({ link }: { link: string }) => {

  return (
    <Tooltip>
      <TooltipTrigger>
        <Link href={link}>
          <Button size="icon">
            <RiEditLine />
          </Button>
        </Link>
      </TooltipTrigger>
      <TooltipContent>Edit</TooltipContent>
    </Tooltip>
  );
};

export default EditButton;
